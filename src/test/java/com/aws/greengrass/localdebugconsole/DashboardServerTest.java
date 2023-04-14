/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole;

import com.aws.greengrass.lifecyclemanager.Kernel;
import com.aws.greengrass.localdebugconsole.dashboardtestmocks.DashboardClientMock;
import com.aws.greengrass.localdebugconsole.messageutils.ComponentItem;
import com.aws.greengrass.localdebugconsole.messageutils.DepGraphNode;
import com.aws.greengrass.localdebugconsole.messageutils.Dependency;
import com.aws.greengrass.localdebugconsole.messageutils.PackedRequest;
import com.aws.greengrass.logging.impl.GreengrassLogMessage;
import com.aws.greengrass.logging.impl.LogManager;
import com.aws.greengrass.testcommons.testutilities.GGExtension;
import com.aws.greengrass.util.Pair;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Consumer;

import static com.aws.greengrass.localdebugconsole.DashboardServer.SERVER_START_MESSAGE;
import static com.aws.greengrass.logging.impl.Slf4jLogAdapter.addGlobalListener;
import static com.aws.greengrass.logging.impl.Slf4jLogAdapter.removeGlobalListener;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Answers.RETURNS_SMART_NULLS;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(GGExtension.class)
class DashboardServerTest {
    static int dashboardServerPort;
    static URI address;
    private static DashboardClientMock dm;
    private static final KernelCommunicator kc = mock(KernelCommunicator.class, RETURNS_SMART_NULLS);
    private static final Authenticator authenticator = mock(Authenticator.class);
    private static DashboardServer ds;

    static final ComponentItem[] expList = new ComponentItem[]{new ComponentItem("foo", "0.0.0", "Running", "running",
            "User",
            false, true), new ComponentItem("bar", "0.0.5", "Errored", "error", "User",
            true, false)};
    static final DepGraphNode[] expDepGraph = new DepGraphNode[]{new DepGraphNode("foo",
            new Dependency[]{new Dependency("bar", true)})};

    @BeforeAll
    static void initMocks() throws InterruptedException, URISyntaxException {
        CountDownLatch startupLatch = new CountDownLatch(1);
        Consumer<GreengrassLogMessage> listener = structuredLogMessage -> {
            if (SERVER_START_MESSAGE.equals(structuredLogMessage.getMessage())) {
                startupLatch.countDown();
            }
        };
        when(authenticator.isUsernameAndPasswordValid(any())).thenReturn(true);

        addGlobalListener(listener);
        ds = new DashboardServer(new InetSocketAddress("localhost", dashboardServerPort),
                LogManager.getLogger(Kernel.class), kc, authenticator, null, null, null);
        ds.startup();
        assertTrue(startupLatch.await(5, TimeUnit.SECONDS));
        dashboardServerPort = ds.getPort();
        address = new URI("ws://localhost:" + dashboardServerPort);
        removeGlobalListener(listener);
    }

    @AfterEach
    void closeConnections() {
        if (dm != null) {
            dm.close();
        }
        // wipe subscriptions
        ds.clearSubscriptions();
        reset(authenticator);
        when(authenticator.isUsernameAndPasswordValid(any())).thenReturn(true);
    }

    @AfterAll
    static void tearDown() throws IOException, InterruptedException {
        ds.stop();
    }

    @Test
    void GIVEN_dashboard_with_no_connection_history_WHEN_pushes_are_called_THEN_there_are_no_errors() {
        ds.pushComponentListUpdate();
        ds.pushComponentChange("main");
        ds.pushDependencyGraphUpdate();
    }

    @Test
    void GIVEN_dashboard_with_no_connection_history_WHEN_connections_are_opened_THEN_autopassed_data_can_be_passed()
            throws InterruptedException, TimeoutException, ExecutionException {
        dm = new DashboardClientMock(address, LogManager.getLogger(Kernel.class));
        dm.init().get(200, TimeUnit.MILLISECONDS);
        verify(authenticator).isUsernameAndPasswordValid(new Pair<>("abc", "def"));

        Assertions.assertEquals("_fake_call", dm.sendRequest(new PackedRequest(12, "_fake_call", new String[]{})).get());

        when(kc.getComponentList()).thenReturn(expList);
        when(kc.getComponent("foo")).thenReturn(expList[0]);
        when(kc.getDependencyGraph()).thenReturn(expDepGraph);

        dm.listLatch = new CountDownLatch(1);
        dm.componentLatch = new CountDownLatch(1);
        dm.depGraphLatch = new CountDownLatch(1);

        ds.pushComponentListUpdate();
        ds.pushComponentChange("foo");
        ds.pushDependencyGraphUpdate();

        dm.listLatch.await(100, TimeUnit.MILLISECONDS);
        dm.componentLatch.await(100, TimeUnit.MILLISECONDS);
        dm.depGraphLatch.await(100, TimeUnit.MILLISECONDS);

        Arrays.sort(expList);
        Arrays.sort(dm.latestList);
        assertArrayEquals(expList, dm.latestList);
        assertNotEquals(expList[0],
                dm.latestComponent);

        Arrays.sort(expDepGraph);
        Arrays.sort(dm.latestDepGraph);
        assertArrayEquals(expDepGraph, dm.latestDepGraph);
    }

    @Test
    void GIVEN_multiple_connections_WHEN_server_pushes_THEN_all_connections_get_messages()
            throws InterruptedException, ExecutionException, TimeoutException {
        dm = new DashboardClientMock(address, LogManager.getLogger(Kernel.class));
        dm.init().get(500, TimeUnit.MILLISECONDS);

        DashboardClientMock otherConnection = new DashboardClientMock(address, LogManager.getLogger(Kernel.class));
        otherConnection.init().get(500, TimeUnit.MILLISECONDS);

        when(kc.getComponentList()).thenReturn(expList);
        when(kc.getDependencyGraph()).thenReturn(expDepGraph);

        dm.listLatch = new CountDownLatch(1);
        dm.depGraphLatch = new CountDownLatch(1);
        otherConnection.listLatch = new CountDownLatch(1);
        otherConnection.depGraphLatch = new CountDownLatch(1);

        ds.pushComponentListUpdate();
        ds.pushDependencyGraphUpdate();

        Assertions.assertTrue(dm.listLatch.await(500, TimeUnit.MILLISECONDS));
        Assertions.assertTrue(dm.depGraphLatch.await(500, TimeUnit.MILLISECONDS));
        Assertions.assertTrue(otherConnection.listLatch.await(500, TimeUnit.MILLISECONDS));
        Assertions.assertTrue(otherConnection.depGraphLatch.await(500, TimeUnit.MILLISECONDS));

        otherConnection.close();
    }


    @Test
    void GIVEN_connections_inited_WHEN_subscriptions_to_components_are_made_THEN_they_are_pushed()
            throws InterruptedException, ExecutionException, TimeoutException {
        dm = new DashboardClientMock(address, LogManager.getLogger(Kernel.class));
        dm.init().get(200, TimeUnit.MILLISECONDS);

        when(kc.getComponent("foo")).thenReturn(expList[0]);
        when(kc.getComponent("bar")).thenReturn(expList[1]);

        dm.componentPushes.clear();

        dm.componentLatch = new CountDownLatch(1);
        dm.sendRequest(new PackedRequest(15, APICalls.subscribeToComponent.name(),
                new String[]{"foo"}));
        dm.componentLatch.await(100, TimeUnit.MILLISECONDS);
        Assertions.assertTrue(dm.findComponentPush(expList[0]).isPresent());

        dm.componentLatch = new CountDownLatch(3);
        dm.sendRequest(new PackedRequest(17, APICalls.subscribeToComponent.name(),
                new String[]{"bar"})).get();
        ds.pushComponentChange("foo");
        ds.pushComponentChange("bar");
        dm.componentLatch.await(100, TimeUnit.MILLISECONDS);
        Assertions.assertEquals(4, dm.componentPushes.size());
    }

    @Test
    void GIVEN_connections_inited_WHEN_subscriptions_are_not_present_THEN_they_are_not_pushed()
            throws InterruptedException, TimeoutException, ExecutionException {
        dm = new DashboardClientMock(address, LogManager.getLogger(Kernel.class));
        assertNotNull(dm.init().get(200, TimeUnit.MILLISECONDS));

        when(kc.getComponent("foo")).thenReturn(expList[0]);
        when(kc.getComponent("bar")).thenReturn(expList[1]);
        when(kc.getComponent("baz")).thenReturn(null);

        dm.responseLatch = new CountDownLatch(4);
        dm.componentLatch = new CountDownLatch(1);
        dm.sendRequest(new PackedRequest(18, APICalls.subscribeToComponent.name(),
                new String[]{"foo"}));
        Assertions.assertTrue(dm.componentLatch.await(200, TimeUnit.MILLISECONDS));
        Assertions.assertTrue(dm.findComponentPush(expList[0]).isPresent());

        dm.componentLatch = new CountDownLatch(1);
        dm.sendRequest(new PackedRequest(20, APICalls.subscribeToComponent.name(),
                new String[]{"bar"})).get();
        dm.sendRequest(new PackedRequest(21, APICalls.unsubscribeToComponent.name(),
                new String[]{"foo"})).get();
        dm.sendRequest(new PackedRequest(23, APICalls.unsubscribeToComponent.name(),
                new String[]{"bar"})).get();
        Assertions.assertTrue(dm.componentLatch.await(200, TimeUnit.MILLISECONDS));
        Assertions.assertTrue(dm.responseLatch.await(500, TimeUnit.MILLISECONDS));

        dm.componentLatch = new CountDownLatch(1);
        ds.pushComponentChange("foo");
        ds.pushComponentChange("bar");
        ds.pushComponentChange("baz");
        Assertions.assertFalse(dm.componentLatch.await(300, TimeUnit.MILLISECONDS));
    }

    @Test
    void GIVEN_connections_inited_WHEN_subscriptions_are_made_to_nonexistent_components_THEN_they_push_null()
            throws InterruptedException, TimeoutException, ExecutionException {
        dm = new DashboardClientMock(address, LogManager.getLogger(Kernel.class));
        dm.init().get(200, TimeUnit.MILLISECONDS);

        when(kc.getComponent(anyString())).thenReturn(null);

        dm.componentLatch = new CountDownLatch(1);
        dm.sendRequest(new PackedRequest(24, APICalls.subscribeToComponent.name(),
                new String[]{"foo"}));
        dm.componentLatch.await(100, TimeUnit.MILLISECONDS);
        Assertions.assertTrue(dm.findComponentPush(null).isPresent());
    }


    @Test
    void GIVEN_dashboard_with_closed_connections_WHEN_pushes_are_called_THEN_there_are_no_errors()
            throws InterruptedException, TimeoutException, ExecutionException {
        dm = new DashboardClientMock(address, LogManager.getLogger(Kernel.class));
        dm.init().get(200, TimeUnit.MILLISECONDS);
        dm.close();
        ds.pushComponentListUpdate();
        ds.pushComponentChange("main");
        ds.pushDependencyGraphUpdate();
    }
}
