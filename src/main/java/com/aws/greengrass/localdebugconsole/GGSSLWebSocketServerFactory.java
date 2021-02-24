/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole;

import org.java_websocket.SSLSocketChannel2;
import org.java_websocket.WebSocketAdapter;
import org.java_websocket.WebSocketImpl;
import org.java_websocket.WebSocketServerFactory;
import org.java_websocket.drafts.Draft;
import org.java_websocket.server.DefaultSSLWebSocketServerFactory;

import java.io.IOException;
import java.nio.channels.ByteChannel;
import java.nio.channels.SelectionKey;
import java.nio.channels.SocketChannel;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.inject.Provider;
import javax.net.ssl.SSLEngine;

/**
 * This class is based on {@link DefaultSSLWebSocketServerFactory} but instead of accepting a {@link javax.net.ssl.SSLContext}
 * it instead takes a provider of {@link SSLEngine}.
 */
public class GGSSLWebSocketServerFactory implements WebSocketServerFactory {
    protected Provider<SSLEngine> engineProvider;
    protected ExecutorService exec;

    public GGSSLWebSocketServerFactory(Provider<SSLEngine> engineProvider) {
        this(engineProvider, Executors.newSingleThreadScheduledExecutor());
    }

    public GGSSLWebSocketServerFactory(Provider<SSLEngine> engineProvider, ExecutorService exec) {
        if (engineProvider != null && exec != null) {
            this.engineProvider = engineProvider;
            this.exec = exec;
        } else {
            throw new IllegalArgumentException();
        }
    }

    public ByteChannel wrapChannel(SocketChannel channel, SelectionKey key) throws IOException {
        SSLEngine e = this.engineProvider.get();
        List<String> ciphers = new ArrayList<>(Arrays.asList(e.getEnabledCipherSuites()));
        ciphers.remove("TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256");
        e.setEnabledCipherSuites(ciphers.toArray(new String[0]));
        e.setUseClientMode(false);
        return new SSLSocketChannel2(channel, e, this.exec, key);
    }

    public WebSocketImpl createWebSocket(WebSocketAdapter a, Draft d) {
        return new WebSocketImpl(a, d);
    }

    public WebSocketImpl createWebSocket(WebSocketAdapter a, List<Draft> d) {
        return new WebSocketImpl(a, d);
    }

    public void close() {
        this.exec.shutdownNow();
    }
}
