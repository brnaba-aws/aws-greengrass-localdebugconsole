/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole;

import com.aws.greengrass.config.Topic;
import com.aws.greengrass.dependency.State;
import com.aws.greengrass.lifecyclemanager.GlobalStateChangeListener;
import com.aws.greengrass.lifecyclemanager.GreengrassService;
import com.aws.greengrass.lifecyclemanager.Kernel;
import com.aws.greengrass.lifecyclemanager.exceptions.ServiceLoadException;
import com.aws.greengrass.localdebugconsole.messageutils.ConfigMessage;
import com.aws.greengrass.localdebugconsole.messageutils.DepGraphNode;
import com.aws.greengrass.localdebugconsole.messageutils.Dependency;
import com.aws.greengrass.logging.api.Logger;
import com.aws.greengrass.logging.impl.LogManager;
import com.aws.greengrass.testcommons.testutilities.GGExtension;
import com.aws.greengrass.testcommons.testutilities.NoOpPathOwnershipHandler;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mockito;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static com.aws.greengrass.componentmanager.KernelConfigResolver.VERSION_CONFIG_KEY;
import static com.aws.greengrass.localdebugconsole.SimpleHttpServer.AWS_GREENGRASS_DEBUG_SERVER;
import static com.aws.greengrass.testcommons.testutilities.ExceptionLogProtector.ignoreExceptionOfType;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

@ExtendWith(GGExtension.class)
class KernelCommunicatorTest {

    private static Kernel kernel;
    private static KernelCommunicator kc;
    private static DashboardServer ds;

    @TempDir
    static Path rootDir;

    private static final CountDownLatch consoleRunningCountdown = new CountDownLatch(1);
    static GlobalStateChangeListener consoleRunning = (GreengrassService service, State oldState,
                                                       State newState) -> {
        if (AWS_GREENGRASS_DEBUG_SERVER.equals(service.getName())) {
            if (State.RUNNING.equals(newState)) {
                consoleRunningCountdown.countDown();
            }
        }
    };

    @BeforeAll
    static void setup() throws InterruptedException {
        ds = mock(DashboardServer.class);
        System.setProperty("root", rootDir.toAbsolutePath().toString());
        // Set this property for kernel to scan its own classpath to find plugins
        System.setProperty("aws.greengrass.scanSelfClasspath", "true");
        kernel = new Kernel();
        kernel.getContext().addGlobalStateChangeListener(consoleRunning);
        NoOpPathOwnershipHandler.register(kernel);
        kernel.parseArgs("-i", KernelCommunicatorTest.class.getResource("kernelPushTest.yaml").toString());
        kernel.launch();
        Logger logger = LogManager.getLogger(Kernel.class);
        KernelCommunicator temp = new KernelCommunicator(kernel, logger, null);
        kc = Mockito.spy(temp);
        kc.linkWithPusher(ds);
        kc.linkWithKernel();
        assertTrue(consoleRunningCountdown.await(10, TimeUnit.SECONDS));
    }

    @AfterAll
    static void tearDown() {
        kernel.shutdown();
    }

    @Test
    void GIVEN_steady_state_WHEN_component_state_changes_THEN_list_and_component_are_pushed()
            throws InterruptedException {
        Thread.sleep(200);
        verify(ds, atLeastOnce()).pushComponentChange("main");
        verify(ds, atLeastOnce()).pushComponentListUpdate();
    }

    @Test
    void GIVEN_component_exists_WHEN_start_stop_reinstall_called_THEN_returns_true() {
        assertTrue(kc.startComponent("main"));
        assertTrue(kc.stopComponent("main"));
        assertTrue(kc.reinstallComponent("main"));
    }

    @Test
    void GIVEN_component_doesnt_exist_WHEN_start_stop_reinstall_called_THEN_return_false() {
        assertFalse(kc.startComponent("foo"));
        assertFalse(kc.stopComponent("foo"));
        assertFalse(kc.reinstallComponent("foo"));
    }

    @Test
    void GIVEN_kernel_is_initialized_AND_component_exists_WHEN_component_config_get_THEN_it_works() {
        ConfigMessage cm = kc.getConfig("main");
        assertTrue(cm.successful);
        assertNull(cm.errorMsg);
        assertNotNull(cm.yaml);
    }

    @Test
    void GIVEN_kernel_is_initialized_AND_component_doesnt_exist_WHEN_component_config_get_THEN_it_doesnt_work(
            ExtensionContext context) {
        ignoreExceptionOfType(context, ServiceLoadException.class);
        ConfigMessage cm = kc.getConfig("foo");
        assertFalse(cm.successful);
        assertNotNull(cm.errorMsg);
        assertNull(cm.yaml);
    }

    @Test
    void GIVEN_component_exists_WHEN_version_is_updated_THEN_update_is_passed_to_kernel_and_pushed()
            throws IOException, ServiceLoadException {
        String newConfig = readFromFile("newVersion.yaml");
        kc.updateConfig("versionCtrl", newConfig);
        verify(ds, after(50).atLeastOnce()).pushComponentListUpdate();
        verify(ds, after(50).atLeastOnce()).pushComponentChange("versionCtrl");
        Topic tpc = kernel.locate("versionCtrl").getConfig().find(VERSION_CONFIG_KEY);
        assertEquals("1.0.1", tpc.getOnce());
    }

    @Test
    void GIVEN_component_exists_WHEN_dependencies_are_updated_through_config_change_THEN_update_is_pushed()
            throws IOException, InterruptedException {
        CountDownLatch countDownLatch = new CountDownLatch(1);
        doAnswer(f -> {
            countDownLatch.countDown();
            return null;
        }).when(ds).pushDependencyGraphUpdate();

        String newConfig = readFromFile("dependencyChange.yaml");
        kc.updateConfig("main", newConfig);
        assertTrue(countDownLatch.await(1, TimeUnit.SECONDS));
        kernel.getContext().waitForPublishQueueToClear();

        DepGraphNode[] expected = {
                new DepGraphNode("blindside", new Dependency[0]), new DepGraphNode("main",
                new Dependency[]{new Dependency("blindside", true), new Dependency("versionCtrl", true)}),
                new DepGraphNode("versionCtrl", new Dependency[]{new Dependency("blindside", true)})};
        Arrays.sort(expected);
        DepGraphNode[] actual = kc.getDependencyGraph();
        Arrays.sort(actual);
        assertArrayEquals(expected, actual);
    }

    String readFromFile(String resource) throws IOException {
        InputStream is = KernelCommunicatorTest.class.getResourceAsStream(resource);
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            return reader.lines().collect(Collectors.joining("\n"));
        }
    }
}
