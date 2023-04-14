/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole;

import com.aws.greengrass.dependency.State;
import com.aws.greengrass.lifecyclemanager.GlobalStateChangeListener;
import com.aws.greengrass.lifecyclemanager.GreengrassService;
import com.aws.greengrass.lifecyclemanager.Kernel;
import com.aws.greengrass.localdebugconsole.dashboardtestmocks.DashboardClientMock;
import com.aws.greengrass.localdebugconsole.messageutils.PackedRequest;
import com.aws.greengrass.logging.api.Logger;
import com.aws.greengrass.logging.impl.GreengrassLogMessage;
import com.aws.greengrass.logging.impl.LogManager;
import com.aws.greengrass.testcommons.testutilities.GGExtension;
import com.aws.greengrass.testcommons.testutilities.NoOpPathOwnershipHandler;
import com.aws.greengrass.util.Coerce;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import software.amazon.awssdk.http.HttpExecuteRequest;
import software.amazon.awssdk.http.SdkHttpMethod;
import software.amazon.awssdk.http.SdkHttpRequest;
import software.amazon.awssdk.http.apache.ApacheHttpClient;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import static com.aws.greengrass.localdebugconsole.DashboardServer.SERVER_START_MESSAGE;
import static com.aws.greengrass.localdebugconsole.SimpleHttpServer.AWS_GREENGRASS_DEBUG_SERVER;
import static com.aws.greengrass.localdebugconsole.SimpleHttpServer.CERT_FINGERPRINT_NAMESPACE;
import static com.aws.greengrass.localdebugconsole.SimpleHttpServer.SHA_1_ALGORITHM;
import static com.aws.greengrass.localdebugconsole.SimpleHttpServer.SHA_256_ALGORITHM;
import static com.aws.greengrass.localdebugconsole.SimpleHttpServer.fingerprintCert;
import static com.aws.greengrass.localdebugconsole.dashboardtestmocks.RequestIDGenerator.reqId;
import static com.aws.greengrass.logging.impl.Slf4jLogAdapter.addGlobalListener;
import static com.aws.greengrass.logging.impl.Slf4jLogAdapter.removeGlobalListener;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

@ExtendWith(GGExtension.class)
class DashboardIntegrationTest {
    private static DashboardServer dashboardServer;
    private static DashboardClientMock dm;
    private static Kernel kernel;

    private static final CountDownLatch brokenCountdown = new CountDownLatch(1);
    private static final CountDownLatch finishedCountdown = new CountDownLatch(1);
    private static final CountDownLatch consoleRunningCountdown = new CountDownLatch(1);

    @TempDir
    static Path rootDir;

    @BeforeAll
    static void setup() throws URISyntaxException, InterruptedException, TimeoutException, ExecutionException {
        System.setProperty("root", rootDir.toAbsolutePath().toString());
        // Set this property for kernel to scan its own classpath to find plugins
        System.setProperty("aws.greengrass.scanSelfClasspath", "true");
        kernel = new Kernel();
        NoOpPathOwnershipHandler.register(kernel);
        kernel.parseArgs("-i", KernelCommunicatorTest.class.getResource("dashboardIntegTest.yaml").toString());
        kernel.getContext().addGlobalStateChangeListener(countdownDefinitelyBroken);
        kernel.getContext().addGlobalStateChangeListener(consoleRunning);
        kernel.launch();
        Logger logger = LogManager.getLogger(Kernel.class);

        CountDownLatch startupLatch = new CountDownLatch(1);
        Consumer<GreengrassLogMessage> listener = structuredLogMessage -> {
            if (SERVER_START_MESSAGE.equals(structuredLogMessage.getMessage())) {
                startupLatch.countDown();
            }
        };
        addGlobalListener(listener);
        dashboardServer = new DashboardServer(new InetSocketAddress("localhost", 0), logger, kernel,
                null, (a) -> true, null);

        dashboardServer.startup();
        // wait for steady state
        assertTrue(startupLatch.await(10, TimeUnit.SECONDS));
        assertTrue(consoleRunningCountdown.await(10, TimeUnit.SECONDS));
        URI address = new URI("ws://localhost:" + dashboardServer.getPort());
        dm = new DashboardClientMock(address, LogManager.getLogger(Kernel.class));
        dm.init().get(2, TimeUnit.SECONDS);
        removeGlobalListener(listener);
    }

    @AfterAll
    static void teardown() throws IOException, InterruptedException {
        dm.close();
        Thread.sleep(100);
        dashboardServer.stop();
        kernel.shutdown();
    }

    @AfterEach
    void clearSubscriptions() {
        dashboardServer.clearSubscriptions();
    }

    @Test
    void GIVEN_backend_is_initialized_WHEN_force_pushes_are_called_THEN_it_works() throws InterruptedException {
        dm.listLatch = new CountDownLatch(1);
        dm.sendRequest(new PackedRequest(reqId(), APICalls.forcePushComponentList.name(),
                new String[0]));
        assertTrue(dm.listLatch.await(200, TimeUnit.MILLISECONDS));

        dm.depGraphLatch = new CountDownLatch(1);
        dm.sendRequest(new PackedRequest(reqId(), APICalls.forcePushDependencyGraph.name(),
                new String[0]));
        assertTrue(dm.depGraphLatch.await(200, TimeUnit.MILLISECONDS));
    }

    @Test
    void GIVEN_steady_state_WHEN_component_state_changes_THEN_list_is_pushed()
            throws InterruptedException, ExecutionException {
        Thread.sleep(500);
        dm.listLatch = new CountDownLatch(1);
        dm.sendRequest(new PackedRequest(reqId(), APICalls.startComponent.name(), new String[]{
                "testList"})).get();
        assertTrue(dm.listLatch.await(5, TimeUnit.SECONDS));
    }

    @Test
    void GIVEN_subscription_to_component_WHEN_state_changes_THEN_component_is_pushed()
            throws InterruptedException, ExecutionException {
        dm.componentLatch = new CountDownLatch(1);
        dm.sendRequest(new PackedRequest(reqId(), APICalls.subscribeToComponent.name(), new String[]{
                "testComponent"})).get();
        dm.sendRequest(new PackedRequest(reqId(), APICalls.startComponent.name(), new String[]{
                "testComponent"}));
        assertTrue(dm.componentLatch.await(200, TimeUnit.MILLISECONDS));
    }

    @Test
    void GIVEN_unsubscription_to_component_WHEN_state_changes_THEN_component_is_not_pushed()
            throws ExecutionException, InterruptedException {
        dm.componentLatch = new CountDownLatch(1);
        dm.sendRequest(new PackedRequest(reqId(), APICalls.subscribeToComponent.name(), new String[]{
                "testComponent"})).get();
        dm.sendRequest(new PackedRequest(reqId(), APICalls.unsubscribeToComponent.name(), new String[]{
                "testComponent"})).get();
        // wait for the subscription to hit before resetting the latch
        assertTrue(dm.componentLatch.await(1, TimeUnit.SECONDS));
        dm.componentLatch = new CountDownLatch(1);

        dm.sendRequest(new PackedRequest(reqId(), APICalls.startComponent.name(), new String[]{
                "testComponent"}));
        dm.sendRequest(new PackedRequest(reqId(), APICalls.startComponent.name(), new String[]{
                "testList"}));
        assertFalse(dm.componentLatch.await(500, TimeUnit.MILLISECONDS));
    }

    @Test
    void GIVEN_states_are_stable_WHEN_a_component_is_updated_THEN_getComponent_and_getComponentList_return_updated_component()
            throws ExecutionException, InterruptedException {
        CountDownLatch finishedLatch = new CountDownLatch(1);
        GlobalStateChangeListener listener = (GreengrassService service, State oldState, State newState) -> {
            if ("whileTrue".equals(service.getName()) && newState == State.FINISHED) {
                finishedLatch.countDown();
            }
        };
        kernel.getContext().addGlobalStateChangeListener(listener);
        dm.componentLatch = new CountDownLatch(1);
        dm.sendRequest(new PackedRequest(reqId(), APICalls.subscribeToComponent.name(), new String[]{
                "whileTrue"})).get();
        // wait for the subscription to hit before resetting the latch
        assertTrue(dm.componentLatch.await(1, TimeUnit.SECONDS));

        dm.componentLatch = new CountDownLatch(1);
        dm.listLatch = new CountDownLatch(1);
        dm.sendRequest(new PackedRequest(reqId(), APICalls.startComponent.name(), new String[]{
                "whileTrue"})).get();
        dm.sendRequest(new PackedRequest(reqId(), APICalls.stopComponent.name(), new String[]{
                "whileTrue"})).get();
        if (!finishedLatch.await(3, TimeUnit.SECONDS)) {
            fail("whileTrue component did not reach finished state within the allotted time");
        }
        assertTrue(dm.listLatch.await(200, TimeUnit.MILLISECONDS));
        assertTrue(dm.componentLatch.await(200, TimeUnit.MILLISECONDS));
    }

    @Test
    void GIVEN_dependencies_are_stable_WHEN_a_state_changes_THEN_the_dependency_graph_is_not_pushed()
            throws ExecutionException, InterruptedException {
        dm.depGraphLatch = new CountDownLatch(1);
        dm.sendRequest(new PackedRequest(reqId(), APICalls.startComponent.name(), new String[]{
                "whileTrue"})).get();
        dm.sendRequest(new PackedRequest(reqId(), APICalls.stopComponent.name(), new String[]{
                "whileTrue"})).get();
        assertFalse(dm.depGraphLatch.await(200, TimeUnit.MILLISECONDS));
    }

    @Test
    void GIVEN_a_component_is_broken_WHEN_the_config_is_fixed_and_reinstalled_THEN_the_component_functions_properly()
            throws IOException, ExecutionException, InterruptedException {
        // wait for steady-state
        assertTrue(brokenCountdown.await(5, TimeUnit.SECONDS));

        dm.sendRequest(new PackedRequest(reqId(),
                APICalls.updateConfig.name(),
                new String[]{"definitelyBroken", readFromFile(
                "nonBrokenRunningConfig.yaml")})).get();
        dm.sendRequest(new PackedRequest(reqId(), APICalls.reinstallComponent.name(), new String[]{
                "definitelyBroken"})).get();

        // allow service to reach steady-state
        assertTrue(finishedCountdown.await(10, TimeUnit.SECONDS));
    }

    @Test
    void GIVEN_running_server_THEN_we_can_connect_using_TLS()
            throws ExecutionException, InterruptedException, TimeoutException, IOException {
        assertNotNull(Coerce.toString(kernel.getConfig().find(CERT_FINGERPRINT_NAMESPACE, SHA_1_ALGORITHM)));
        assertNotNull(Coerce.toString(kernel.getConfig().find(CERT_FINGERPRINT_NAMESPACE, SHA_256_ALGORITHM)));

        CompletableFuture<Void> cf = new CompletableFuture<>();
        ApacheHttpClient.builder().tlsTrustManagersProvider(() -> new TrustManager[]{new X509TrustManager() {
            @Override
            public void checkClientTrusted(X509Certificate[] chain, String authType) {
            }

            @Override
            public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                try {
                    assertEquals(Coerce.toString(kernel.getConfig().find(CERT_FINGERPRINT_NAMESPACE, SHA_1_ALGORITHM)),
                            fingerprintCert(chain[0], SHA_1_ALGORITHM));
                    assertEquals(
                            Coerce.toString(kernel.getConfig().find(CERT_FINGERPRINT_NAMESPACE, SHA_256_ALGORITHM)),
                            fingerprintCert(chain[0], SHA_256_ALGORITHM));
                    cf.complete(null);
                } catch (NoSuchAlgorithmException ignored) {
                }
            }

            @Override
            public X509Certificate[] getAcceptedIssuers() {
                return new X509Certificate[0];
            }
        }}).build().prepareRequest(HttpExecuteRequest.builder().request(
                SdkHttpRequest.builder().method(SdkHttpMethod.GET)
                        .uri(URI.create("https://localhost:" + kernel.getContext().get(SimpleHttpServer.class).port))
                        .build()).build()).call();
        cf.get(2, TimeUnit.SECONDS);
    }

    static GlobalStateChangeListener countdownDefinitelyBroken = (GreengrassService service, State oldState,
                                                                  State newState) -> {
        if ("definitelyBroken".equals(service.getName())) {
            if (State.BROKEN.equals(newState)) {
                brokenCountdown.countDown();
            } else if (State.FINISHED.equals(newState)) {
                finishedCountdown.countDown();
            }
        }
    };

    static GlobalStateChangeListener consoleRunning = (GreengrassService service, State oldState,
                                                                  State newState) -> {
        if (AWS_GREENGRASS_DEBUG_SERVER.equals(service.getName())) {
            if (State.RUNNING.equals(newState)) {
                consoleRunningCountdown.countDown();
            }
        }
    };

    String readFromFile(String resource) throws IOException {
        InputStream is = KernelCommunicatorTest.class.getResourceAsStream(resource);
        try (BufferedReader reader = new BufferedReader(new InputStreamReader
                (is, StandardCharsets.UTF_8))) {
            return reader.lines().collect(Collectors.joining("\n"));
        }
    }
}
