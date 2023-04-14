/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole.dashboardtestmocks;

import com.aws.greengrass.localdebugconsole.APICalls;
import com.aws.greengrass.localdebugconsole.messageutils.ComponentItem;
import com.aws.greengrass.localdebugconsole.messageutils.DepGraphNode;
import com.aws.greengrass.localdebugconsole.messageutils.Message;
import com.aws.greengrass.localdebugconsole.messageutils.MessageType;
import com.aws.greengrass.localdebugconsole.messageutils.PackedRequest;
import com.aws.greengrass.logging.api.Logger;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;

import javax.annotation.Nullable;

public class DashboardClientMock extends WebSocketClient {
    private final ObjectMapper jsonMapper = new ObjectMapper();
    private final Logger logger;

    CompletableFuture<Object> connectionFuture = new CompletableFuture<>();

    public ArrayList<Message> responses = new ArrayList<>();
    public ArrayList<ComponentItem[]> listPushes = new ArrayList<>();
    public ArrayList<DepGraphNode[]> depGraphPushes = new ArrayList<>();
    public ArrayList<ComponentItem> componentPushes = new ArrayList<>();
    public ArrayList<Object> logPushes = new ArrayList<>();

    public Message latestResponse;
    public ComponentItem[] latestList;
    public DepGraphNode[] latestDepGraph;
    public ComponentItem latestComponent;
    public Object latestLog;

    public CountDownLatch responseLatch = new CountDownLatch(Integer.MAX_VALUE);
    public CountDownLatch listLatch = new CountDownLatch(Integer.MAX_VALUE);
    public CountDownLatch depGraphLatch = new CountDownLatch(Integer.MAX_VALUE);
    public CountDownLatch componentLatch = new CountDownLatch(Integer.MAX_VALUE);
    public CountDownLatch logLatch = new CountDownLatch(Integer.MAX_VALUE);


    Map<Long, CompletableFuture<Object>> openRequests = new HashMap<>();

    public DashboardClientMock(URI serverUri, Logger logger) {
        super(serverUri);
        this.logger = logger;
    }

    @Override
    public void onOpen(ServerHandshake serverHandshake) {
        sendRequest(new PackedRequest(-1024, APICalls.init.name(), new String[]{"abc", "def"}));
    }

    public CompletableFuture<Object> init() {
        connect();
        return connectionFuture;
    }

    @Override
    public void onMessage(String s) {
        Message parsed;
        try {
            parsed = jsonMapper.readValue(s, Message.class);
        } catch (JsonProcessingException e) {
            logger.atError().setCause(e).log();
            return;
        }
        switch (parsed.getMessageType()) {
            case MessageType.RESPONSE: {
                responses.add(parsed);
                openRequests.get(parsed.getRequestID()).complete(parsed.getPayload());
                latestResponse = parsed;
                responseLatch.countDown();
                break;
            }
            case MessageType.COMPONENT_LIST: {
                try {
                    latestList = jsonMapper.readValue(jsonMapper.writeValueAsString(parsed.getPayload()),
                            ComponentItem[].class);
                } catch (JsonProcessingException e) {
                    logger.atError().setCause(e).log();
                }
                listPushes.add(latestList);
                listLatch.countDown();
                break;
            }
            case MessageType.DEPS_GRAPH: {
                try {
                    latestDepGraph = jsonMapper.readValue(jsonMapper.writeValueAsString(parsed.getPayload()),
                            DepGraphNode[].class);
                } catch (JsonProcessingException e) {
                    logger.atError().setCause(e).log();
                }
                depGraphPushes.add(latestDepGraph);
                depGraphLatch.countDown();
                break;
            }
            case MessageType.COMPONENT_CHANGE: {
                try {
                    latestComponent = jsonMapper.readValue(jsonMapper.writeValueAsString(parsed.getPayload()),
                            ComponentItem.class);
                } catch (JsonProcessingException e) {
                    logger.atError().setCause(e).log();
                }
                componentPushes.add(latestComponent);
                componentLatch.countDown();
                break;
            }
            case MessageType.COMPONENT_LOGS: {
                latestLog = parsed.getPayload();
                logPushes.add(parsed.getPayload());
                logLatch.countDown();
            }
            case MessageType.PUB_SUB_MSG: {
                // TODO
            }
        }
    }

    @Override
    public void onClose(int i, String s, boolean b) {
    }

    @Override
    public void onError(Exception e) {
        logger.atError().setCause(e).log();
    }

    public CompletableFuture<Object> sendRequest(PackedRequest msg){
        if (msg.request.call.equals(APICalls.init.name())) {
            openRequests.put(msg.requestID, connectionFuture);
            try {
                send(jsonMapper.writeValueAsString(msg));
            } catch (JsonProcessingException e) {
                logger.atError().setCause(e).log();
            }
            return connectionFuture;
        }
        CompletableFuture<Object> handle = new CompletableFuture<>();
        openRequests.put(msg.requestID, handle);
        try {
            send(jsonMapper.writeValueAsString(msg));
        } catch (JsonProcessingException e) {
            logger.atError().setCause(e).log();
        }
        return handle;
    }

    @Nullable
    public Message findResponse(Object payload) {
        for (Message msg : responses) {
            try {
                if (jsonMapper.writeValueAsString(msg.getPayload()).equals(jsonMapper.writeValueAsString(payload))) {
                    return msg;
                }
            } catch (JsonProcessingException e) {
                logger.atError().setCause(e).log();
            }
        }
        return null;
    }

    public Optional<Object> findComponentPush(ComponentItem payload) {
        for (ComponentItem ci: componentPushes) {
            try {
                if (jsonMapper.writeValueAsString(ci).equals(jsonMapper.writeValueAsString(payload))) {
                    if (ci != null) {
                        return Optional.of(ci);
                    } else {
                        return Optional.of("null");
                    }
                }
            } catch (JsonProcessingException e) {
                logger.atError().setCause(e).log();
            }
        }
        return Optional.empty();
    }
}
