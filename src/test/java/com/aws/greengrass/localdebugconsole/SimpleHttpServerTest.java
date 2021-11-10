/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */


package com.aws.greengrass.localdebugconsole;

import com.aws.greengrass.config.Topic;
import com.aws.greengrass.lifecyclemanager.Kernel;
import com.aws.greengrass.testcommons.testutilities.GGExtension;
import com.aws.greengrass.util.Pair;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import static com.aws.greengrass.localdebugconsole.SimpleHttpServer.DEBUG_PASSWORD_NAMESPACE;
import static com.aws.greengrass.localdebugconsole.SimpleHttpServer.EXPIRATION_NAMESPACE;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(GGExtension.class)
class SimpleHttpServerTest {

    @TempDir
    Path rootDir;

    private Kernel kernel;

    @AfterEach
    void after() {
        if (kernel != null) {
            kernel.shutdown();
        }
    }

    @Test
    void GIVEN_server_WHEN_authenticate_THEN_cleans_storage() {
        kernel = new Kernel();
        kernel.parseArgs("-r", rootDir.toAbsolutePath().toString());

        SimpleHttpServer http = kernel.getContext().get(SimpleHttpServer.class);

        assertFalse(http.isUsernameAndPasswordValid(null));
        assertFalse(http.isUsernameAndPasswordValid(new Pair<>("a", "b")));

        Topic abExpiration = kernel.getConfig()
                .lookup(DEBUG_PASSWORD_NAMESPACE, "a", "b", EXPIRATION_NAMESPACE)
                .withValue(Instant.now().plus(Duration.ofHours(1)).toEpochMilli());
        assertTrue(http.isUsernameAndPasswordValid(new Pair<>("a", "b")));

        abExpiration.withValue(0);
        assertFalse(http.isUsernameAndPasswordValid(new Pair<>("a", "b")));
        assertNull(kernel.getConfig().findTopics(DEBUG_PASSWORD_NAMESPACE, "a", "b"));

        // Verify that if the password to the keystore is lost we can still initialize https properly
        assertTrue(http.initializeHttps());
        http.getRuntimeConfig().remove(); // remove runtime config so that the password is lost
        kernel.getContext().waitForPublishQueueToClear();
        assertTrue(http.initializeHttps());
    }

    @Test
    void testQueryParsing() {
        qp("a=b", "a", "b");
        qp("a=b&c=d", "a", "b", "c", "d");
        qp("a=b&pause&abc=d=f", "a", "b", "pause", "", "abc", "d=f");
    }

    private void qp(String q, String... kvs) {
        Map<String, String> m = SimpleHttpServer.parseQuery(q);
        int limit = kvs.length;
        for (int i = 0; i < limit; i += 2) {
            Assertions.assertEquals(kvs[i + 1], m.get(kvs[i]));
        }
    }
}
