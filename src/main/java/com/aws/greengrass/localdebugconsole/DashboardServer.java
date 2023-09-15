/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole;

import com.amazonaws.greengrass.streammanager.model.MessageStreamDefinition;
import com.aws.greengrass.builtin.services.pubsub.PubSubIPCEventStreamAgent;
import com.aws.greengrass.builtin.services.pubsub.PublishEvent;
import com.aws.greengrass.builtin.services.pubsub.SubscribeRequest;
import com.aws.greengrass.deployment.DeviceConfiguration;
import com.aws.greengrass.lifecyclemanager.Kernel;
import com.aws.greengrass.localdebugconsole.messageutils.*;
import com.aws.greengrass.logging.api.Logger;
import com.aws.greengrass.mqttclient.MqttClient;
import com.aws.greengrass.mqttclient.MqttRequestException;
import com.aws.greengrass.mqttclient.v5.Publish;
import com.aws.greengrass.mqttclient.v5.Subscribe;
import com.aws.greengrass.mqttclient.v5.Unsubscribe;
import com.aws.greengrass.util.DefaultConcurrentHashMap;
import com.aws.greengrass.util.Pair;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.Getter;
import org.java_websocket.WebSocket;
import org.java_websocket.exceptions.WebsocketNotConnectedException;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import software.amazon.awssdk.aws.greengrass.model.ReceiveMode;

import java.net.InetSocketAddress;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.ExecutionException;
import java.util.function.Consumer;
import javax.inject.Provider;
import javax.inject.Singleton;
import javax.net.ssl.SSLEngine;

@Singleton
public class DashboardServer extends WebSocketServer implements KernelMessagePusher {
    static final String SERVER_START_MESSAGE = "Server started successfully";
    private static final String IOT_CORE_SOURCE = "iotcore";

    private final DashboardAPI dashboardAPI;
    private final Logger logger;
    private static final ObjectMapper jsonMapper = new ObjectMapper();

    private final CopyOnWriteArraySet<WebSocket> connections = new CopyOnWriteArraySet<>();
    private final DefaultConcurrentHashMap<String, Set<WebSocket>> statusWatchlist =
            new DefaultConcurrentHashMap<>(HashSet::new);
    private final DefaultConcurrentHashMap<String, Set<WebSocket>> logWatchlist =
            new DefaultConcurrentHashMap<>(HashSet::new);
    private final DefaultConcurrentHashMap<WebSocket, Map<String, SubscribeRequest>> pubSubWatchList =
            new DefaultConcurrentHashMap<>(ConcurrentHashMap::new);
    private final DefaultConcurrentHashMap<WebSocket, Map<String, Subscribe>> mqttWatchList =
            new DefaultConcurrentHashMap<>(ConcurrentHashMap::new);
    @Getter(AccessLevel.PACKAGE)
    private final CompletableFuture<Object> started = new CompletableFuture<>();
    private final Authenticator authenticator;
    private final MqttClient mqttClient;

    private final StreamManagerHelper streamManagerHelper;

    PubSubIPCEventStreamAgent pubSubIPCAgent;
    private final String SERVICE_NAME = "LocalDebugConsole";

    public DashboardServer(InetSocketAddress address, Logger logger, Kernel root, DeviceConfiguration deviceConfig,
                           Authenticator authenticator, Provider<SSLEngine> engineProvider, String streamManagerAuthToken) {
        this(address, logger, new KernelCommunicator(root, logger, deviceConfig), authenticator, engineProvider,
                root.getContext().get(PubSubIPCEventStreamAgent.class),
                root.getContext().get(MqttClient.class),
                 new StreamManagerHelper(root, streamManagerAuthToken));
    }

    // constructor for unit testing
    DashboardServer(InetSocketAddress address, Logger logger, DashboardAPI dashboardAPI, Authenticator authenticator,
                    Provider<SSLEngine> engineProvider, PubSubIPCEventStreamAgent pubSubIPCAgent,
                    MqttClient mqttClient, StreamManagerHelper streamManagerHelper) {
        super(address);
        setReuseAddr(true);
        setTcpNoDelay(true);
        if (engineProvider != null) {
            setWebSocketFactory(new GGSSLWebSocketServerFactory(engineProvider));
        }
        this.logger = logger;
        this.dashboardAPI = dashboardAPI;
        this.authenticator = authenticator;
        this.logger.atInfo().log("Starting dashboard server on address: {}", address);
        this.pubSubIPCAgent = pubSubIPCAgent;
        this.mqttClient = mqttClient;
        this.streamManagerHelper = streamManagerHelper;
    }

    // links the API impl and starts the socket server
    void startup() {
        if (dashboardAPI instanceof KernelCommunicator) {
            ((KernelCommunicator) dashboardAPI).linkWithPusher(this);
            ((KernelCommunicator) dashboardAPI).linkWithKernel();
        }
        start();
    }

    // for use in testing only
    void clearSubscriptions() {
        statusWatchlist.clear();
        logWatchlist.clear();
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        conn.setAttachment(false);
        connections.add(conn);
        logger.atInfo().log("New connection from {}", conn.getRemoteSocketAddress());
    }

    @Override
    public void onMessage(WebSocket conn, String msg) {
        PackedRequest packedRequest;
        try {
            packedRequest = jsonMapper.readValue(msg, PackedRequest.class);
        } catch (JsonProcessingException e) {
            logger.atError().setCause(e).log("Unable to process the incoming message: {}", msg);
            return;
        }
        Request req = packedRequest.request;
        logger.atDebug().kv("Call", req.call).kv("Socket", conn.getRemoteSocketAddress()).log("Client API call");

        APICalls call;
        try {
            call = APICalls.valueOf(req.call);
        } catch (IllegalArgumentException e) { // if not a valid call, then echo
            sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, req.call));
            return;
        }

        // initialize connection
        if (APICalls.init.equals(call)) {
            logger.atDebug().log("Client connection init");
            String echoResponse = null;
            if (req.args.length != 2 || !authenticator.isUsernameAndPasswordValid(new Pair<>(req.args[0], req.args[1]))) {
                logger.atError().log("Websocket connection is not authenticated");
                try {
                    echoResponse = jsonMapper.writeValueAsString(new Message(MessageType.RESPONSE,
                            packedRequest.requestID, "Not authenticated"));
                    conn.send(echoResponse);
                } catch (JsonProcessingException e) {
                    logger.atError().setCause(e).log("Unable to stringify the message: {}", echoResponse);
                }
                return;
            }
            // Set attachment to true meaning that the client has been authenticated
            conn.setAttachment(true);
            try {
                echoResponse = jsonMapper.writeValueAsString(new Message(MessageType.RESPONSE,
                        packedRequest.requestID, true));
                conn.send(echoResponse);
            } catch (JsonProcessingException j) {
                logger.atError().setCause(j).log("Unable to stringify the message: {}", echoResponse);
            }
        } else {
            switch (call) {
                case getDeviceDetails: {
                    DeviceDetails deviceDetails = dashboardAPI.getDeviceDetails();
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, deviceDetails));
                    break;
                }
                case getComponentList: {
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID,
                            dashboardAPI.getComponentList()));
                    break;
                }
                case getComponent: {
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID,
                            dashboardAPI.getComponent(req.args[0])));
                    break;
                }

                case startComponent: {
                    boolean retval = dashboardAPI.startComponent(req.args[0]);
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, retval));
                    break;
                }
                case stopComponent: {
                    boolean retval = dashboardAPI.stopComponent(req.args[0]);
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, retval));
                    break;
                }
                case reinstallComponent: {
                    boolean retval = dashboardAPI.reinstallComponent(req.args[0]);
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, retval));
                    break;
                }
                case getConfig: {
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID,
                            dashboardAPI.getConfig(req.args[0])));
                    break;
                }
                case updateConfig: {
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID,
                            dashboardAPI.updateConfig(req.args[0], req.args[1])));
                    break;
                }
                case subscribeToComponent: {
                    statusWatchlist.get(req.args[0]).add(conn);
                    pushComponentChange(req.args[0]);
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, true));
                    break;
                }
                case unsubscribeToComponent: {
                    removeFromMapOfLists(statusWatchlist, req.args[0], conn);
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, true));
                    break;
                }
                case subscribeToComponentLogs: {
                    logWatchlist.get(req.args[0]).add(conn);
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, true));
                    break;
                }
                case unsubscribeToComponentLogs: {
                    removeFromMapOfLists(logWatchlist, req.args[0], conn);
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, true));
                    break;
                }
                case forcePushComponentList: {
                    pushComponentListUpdate();
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, true));
                    break;
                }
                case forcePushDependencyGraph: {
                    pushDependencyGraphUpdate();
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, true));
                    break;
                }
                case subscribeToPubSubTopic: {
                    subscribeToPubSubTopic(conn, packedRequest, req);
                    break;
                }
                case publishToPubSubTopic: {
                    publishToPubSubTopic(conn, packedRequest, req);
                    break;
                }
                case unsubscribeToPubSubTopic: {
                    unsubscribeFromPubSubTopic(conn, packedRequest, req);
                    break;
                }
                case streamManagerListStreams: {
                    StreamManagerListStreams(conn, packedRequest);
                    break;
                }
                case streamManagerDescribeStream: {
                    StreamManagerDescribeStream(conn, packedRequest, req);
                    break;
                }

                case streamManagerDeleteMessageStream: {
                    StreamManagerDeleteMessageStream(conn, packedRequest, req);
                    break;
                }

                case streamManagerReadMessages: {
                    StreamManagerReadMessages(conn, packedRequest, req);
                    break;
                }

                case streamManagerAppendMessage:{
                    StreamManagerAppendMessage(conn, packedRequest, req);
                    break;
                }

                case streamManagerCreateMessageStream:{
                    StreamManagerCreateMessageStream(conn, packedRequest, req);
                    break;
                }

                case streamManagerUpdateMessageStream:{
                    StreamManagerUpdateMessageStream(conn, packedRequest, req);
                    break;
                }

                default: { // echo
                    sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, req.call));
                    break;
                }
            }
        }
    }

    private void subscribeToPubSubTopic(WebSocket conn, PackedRequest packedRequest, Request req) {
        JsonNode tree;
        try {
            tree = jsonMapper.readTree(req.args[0]);
        } catch (JsonProcessingException e) {
            sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, e.getMessage()));
            return;
        }

        String topicFilter = tree.get("topicFilter").textValue();
        String source = tree.get("source").textValue();
        String subId = tree.get("subId").textValue();
        try {
            if (IOT_CORE_SOURCE.equals(source)) {
                mqttWatchList.get(conn).computeIfAbsent(subId, (a) -> {
                    Consumer<Publish> cb = (c) -> {
                        CommunicationMessage resMessage =
                                new CommunicationMessage(subId, topicFilter, c.getTopic(),
                                        new String(c.getPayload()));
                        sendIfOpen(conn, new Message(MessageType.PUB_SUB_MSG, resMessage));
                    };
                    Subscribe subReq = Subscribe.builder().callback(cb).topic(topicFilter).build();
                    try {
                        mqttClient.subscribe(subReq).get();
                    } catch (MqttRequestException | InterruptedException | ExecutionException e) {
                        throw new RuntimeException(e);
                    }
                    return subReq;
                });
            } else {
                pubSubWatchList.get(conn).computeIfAbsent(subId, (a) -> {
                    Consumer<PublishEvent> cb = (c) -> {
                        CommunicationMessage resMessage =
                                new CommunicationMessage(subId, topicFilter, c.getTopic(),
                                        new String(c.getPayload()));
                        sendIfOpen(conn, new Message(MessageType.PUB_SUB_MSG, resMessage));
                    };
                    SubscribeRequest subReq = SubscribeRequest.builder().callback(cb)
                            .receiveMode(ReceiveMode.RECEIVE_ALL_MESSAGES).topic(topicFilter)
                            .serviceName(SERVICE_NAME).build();
                    pubSubIPCAgent.subscribe(subReq);
                    return subReq;
                });
            }
            sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, true));
        } catch (Exception e) {
            sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, e.getMessage()));
        }
    }

    private void unsubscribeFromPubSubTopic(WebSocket conn, PackedRequest packedRequest, Request req) {
        SubscribeRequest subReq = pubSubWatchList.get(conn).remove(req.args[0]);
        if (subReq != null) {
            pubSubIPCAgent.unsubscribe(subReq);
        }
        Subscribe mqttSub = mqttWatchList.get(conn).remove(req.args[0]);
        if (mqttSub != null) {
            try {
                mqttClient.unsubscribe(Unsubscribe.builder().topic(mqttSub.getTopic())
                        .subscriptionCallback(mqttSub.getCallback()).build());
            } catch (MqttRequestException e) {
                sendIfOpen(conn,
                        new Message(MessageType.RESPONSE, packedRequest.requestID, e.getMessage()));
                return;
            }
        }
        sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, true));
    }

    private void publishToPubSubTopic(WebSocket conn, PackedRequest packedRequest, Request req) {
        JsonNode tree;
        try {
            tree = jsonMapper.readTree(req.args[0]);
        } catch (JsonProcessingException e) {
            sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, e.getMessage()));
            return;
        }

        String topic = tree.get("topic").textValue();
        String destination = tree.get("destination").textValue();
        String payload = tree.get("payload").textValue();
        try {
            if (IOT_CORE_SOURCE.equals(destination)) {
                mqttClient.publish(Publish.builder()
                        .topic(topic)
                        .payload(payload.getBytes())
                        .build());
            } else {
                pubSubIPCAgent.publish(topic, payload.getBytes(), SERVICE_NAME);
            }
            sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, true));
        } catch (Exception e) {
            sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, e.getMessage()));
        }
    }

    private void StreamManagerListStreams(WebSocket conn, PackedRequest packedRequest) {
        StreamManagerResponseMessage responseMessage = new StreamManagerResponseMessage();
        try {
            responseMessage.streamsList = this.streamManagerHelper.listStreams();
            responseMessage.successful = true;
        }
        catch (Exception e){
            logger.error("Error while listing streams:",e);
            responseMessage.errorMsg = e.getMessage();
        }
        sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, responseMessage));
    }

    private void StreamManagerDescribeStream(WebSocket conn, PackedRequest packedRequest, Request req) {
        StreamManagerResponseMessage responseMessage = new StreamManagerResponseMessage();
        try {
            responseMessage.messageStreamInfo = this.streamManagerHelper.describeStream(req.args[0]);
            responseMessage.successful = true;
        }
        catch (Exception e){
            logger.error("Error while describing stream:",e);
            responseMessage.errorMsg = e.getMessage();
        }
        sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, responseMessage));
    }

    private void StreamManagerDeleteMessageStream(WebSocket conn, PackedRequest packedRequest, Request req) {
        StreamManagerResponseMessage responseMessage = new StreamManagerResponseMessage();
        try {
            this.streamManagerHelper.deleteMessageStream(req.args[0]);
            responseMessage.successful = true;
        }
        catch (Exception e){
            logger.error("Error while deleting stream:", e);
            responseMessage.errorMsg = e.getMessage();
        }
        sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, responseMessage));
    }

    private void StreamManagerReadMessages(WebSocket conn, PackedRequest packedRequest, Request req) {
        StreamManagerResponseMessage responseMessage = new StreamManagerResponseMessage();
        try {
            if (req.args.length == 5) {
                responseMessage.messagesList = this.streamManagerHelper.readMessages(
                                                    req.args[0],
                                                    Long.parseLong(req.args[1]),
                                                    Long.parseLong(req.args[2]),
                                                    Long.parseLong(req.args[3]),
                                                    Long.parseLong(req.args[4]));
                responseMessage.successful = true;
            }
            else{
                logger.atError().log("StreamManagerReadMessages requires 5 arguments");
                responseMessage.errorMsg = "StreamManagerReadMessages requires 5 arguments";
            }
        }
        catch (Exception e){
            logger.error("Error while reading messages:", e);
            responseMessage.errorMsg = e.getMessage();
        }
        sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, responseMessage));
    }

    private void StreamManagerAppendMessage(WebSocket conn, PackedRequest packedRequest, Request req) {
        StreamManagerResponseMessage responseMessage = new StreamManagerResponseMessage();
        try {
            this.streamManagerHelper.appendMessage(req.args[0], req.args[1].getBytes());
            responseMessage.successful = true;
        }
        catch (Exception e){
            logger.error("Error while appending message to the stream:", e);
            responseMessage.errorMsg = e.getMessage();
        }
        sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, responseMessage));
    }

    private void StreamManagerCreateMessageStream(WebSocket conn, PackedRequest packedRequest, Request req) {
        StreamManagerResponseMessage responseMessage = new StreamManagerResponseMessage();
        try {
            MessageStreamDefinition messageStreamDefinition = jsonMapper.readValue(req.args[0], MessageStreamDefinition.class);
            this.streamManagerHelper.createMessageStream(messageStreamDefinition);
            responseMessage.successful = true;
        }
        catch (Exception e){
            logger.error("Error while appending message to the stream:", e);
            responseMessage.errorMsg = e.getMessage();
        }
        sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, responseMessage));
    }

    private void StreamManagerUpdateMessageStream(WebSocket conn, PackedRequest packedRequest, Request req) {
        StreamManagerResponseMessage responseMessage = new StreamManagerResponseMessage();
        try {
            MessageStreamDefinition messageStreamDefinition = jsonMapper.readValue(req.args[0], MessageStreamDefinition.class);
            this.streamManagerHelper.updateMessageStream(messageStreamDefinition);
            responseMessage.successful = true;
        }
        catch (Exception e){
            logger.error("Error while appending message to the stream:", e);
            responseMessage.errorMsg = e.getMessage();
        }
        sendIfOpen(conn, new Message(MessageType.RESPONSE, packedRequest.requestID, responseMessage));
    }


    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        connections.remove(conn);
        statusWatchlist.forEach((name, set) -> set.remove(conn));
        logWatchlist.forEach((name, set) -> set.remove(conn));
        pubSubWatchList.get(conn).forEach((topic, sub) -> pubSubIPCAgent.unsubscribe(sub));
        mqttWatchList.get(conn).forEach((topic, sub) -> {
            try {
                mqttClient.unsubscribe(Unsubscribe.builder()
                        .subscriptionCallback(sub.getCallback())
                        .topic(sub.getTopic()).build());
            } catch (MqttRequestException e) {
                logger.error("failed to unsubscribe", e);
            }
        });
        logger.atInfo()
                .log("closed {} with exit code {}, additional info: {}", conn.getRemoteSocketAddress(), code, reason);
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        logger.atError().setCause(ex).log("an error occurred on connection {}",
                conn == null ? null : conn.getRemoteSocketAddress());
    }

    @Override
    public void onStart() {
        logger.atInfo().log(SERVER_START_MESSAGE);
        started.complete(null);
    }

    @Override
    public void pushComponentListUpdate() {
        for (WebSocket conn : connections) {
            sendIfOpen(conn, new Message(MessageType.COMPONENT_LIST, dashboardAPI.getComponentList()));
        }
    }

    @Override
    public void pushComponentChange(String name) {
        if (statusWatchlist.containsKey(name)) {
            statusWatchlist.computeIfPresent(name, (k,set) -> {
                for (WebSocket conn : set) {
                    sendIfOpen(conn, new Message(MessageType.COMPONENT_CHANGE, dashboardAPI.getComponent(name)));
                }
                return set;
            });
        }
    }

    @Override
    public void pushDependencyGraphUpdate() {
        for (WebSocket conn : connections) {
            sendIfOpen(conn, new Message(MessageType.DEPS_GRAPH, dashboardAPI.getDependencyGraph()));
        }
    }

    void removeFromMapOfLists(Map<String, Set<WebSocket>> map, String key, WebSocket entry) {
        map.get(key).remove(entry);
        map.computeIfPresent(key, (k, v) -> {
            if (v.isEmpty()) {
                return null;
            }
            return v;
        });
    }

    private void sendIfOpen(WebSocket conn, Message msg) {
        if (conn != null && (boolean) conn.getAttachment()) {
            try {
                String temp = jsonMapper.writeValueAsString(msg);
                conn.send(temp);
            } catch (WebsocketNotConnectedException e) {
                // a normal occurrence if the dashboard is not connected, e.g. if the user closes the browser
            } catch (JsonProcessingException j) {
                logger.atError().setCause(j).log("Unable to stringify the message: {}", msg);
            }
        }
    }
}
