package com.aws.greengrass.localdebugconsole;

import com.amazonaws.greengrass.streammanager.client.StreamManagerClient;
import com.amazonaws.greengrass.streammanager.client.StreamManagerClientFactory;
import com.amazonaws.greengrass.streammanager.client.config.StreamManagerAuthInfo;
import com.amazonaws.greengrass.streammanager.client.config.StreamManagerClientConfig;
import com.amazonaws.greengrass.streammanager.client.config.StreamManagerServerInfo;
import com.amazonaws.greengrass.streammanager.client.exception.ClientClosedException;
import com.amazonaws.greengrass.streammanager.client.exception.ConnectException;
import com.amazonaws.greengrass.streammanager.client.exception.StreamManagerException;
import com.amazonaws.greengrass.streammanager.model.Message;
import com.amazonaws.greengrass.streammanager.model.MessageStreamDefinition;
import com.amazonaws.greengrass.streammanager.model.MessageStreamInfo;
import com.amazonaws.greengrass.streammanager.model.ReadMessagesOptions;
import com.aws.greengrass.config.Topic;
import com.aws.greengrass.config.Topics;
import com.aws.greengrass.lifecyclemanager.Kernel;
import com.aws.greengrass.logging.api.Logger;
import com.aws.greengrass.logging.impl.LogManager;
import com.aws.greengrass.util.Coerce;

import java.lang.reflect.Field;
import java.util.List;

import static com.aws.greengrass.authorization.AuthorizationIPCAgent.STREAM_MANAGER_SERVICE_NAME;
import static com.aws.greengrass.componentmanager.KernelConfigResolver.CONFIGURATION_CONFIG_KEY;

public class StreamManagerHelper {

    private final Logger logger;
    private StreamManagerClient client;
    private final String streamManagerAuthToken;

    private boolean isConnected;

    private final Kernel kernel;

    public StreamManagerHelper(Kernel kernel, String authToken) {
        this.logger = LogManager.getLogger(StreamManagerHelper.class);
        this.streamManagerAuthToken = authToken;
        this.isConnected = false;
        this.kernel = kernel;
    }

    private void connect() throws StreamManagerException {
        if (this.client != null) {
            try {
                this.client.close();
            } catch (Exception e) {
                logger.atError().log("Unable to close StreamManager client", e);
            }
        }

        try {
            Integer streamManagerPort = null;
            Topics smTopics = this.kernel.findServiceTopic(STREAM_MANAGER_SERVICE_NAME);
            if (smTopics == null) {
                logger.atDebug().log("{} service topic not found", STREAM_MANAGER_SERVICE_NAME);
            } else {
                Topic portTopic = smTopics.find(CONFIGURATION_CONFIG_KEY, "port");
                if (portTopic == null) {
                    logger.atWarn().log("Stream Manager's ({}) port information not found. Will use default port",
                            STREAM_MANAGER_SERVICE_NAME);
                } else {
                    streamManagerPort = Coerce.toInt(portTopic);
                }
            }
            StreamManagerClientConfig config = StreamManagerClientConfig.builder()
                    .serverInfo(StreamManagerServerInfo.builder().port(streamManagerPort).build()).build();
            StreamManagerAuthInfo authInfo = config.getAuthInfo();
            Field field = authInfo.getClass().getDeclaredField("authToken");
            field.setAccessible(true);
            field.set(authInfo, this.streamManagerAuthToken);

            this.client = StreamManagerClientFactory.standard().withClientConfig(config).build();
            this.isConnected = true;
        } catch (StreamManagerException exception) {
            this.isConnected = false;
            throw exception;
        } catch (IllegalAccessException | NoSuchFieldException e) {
            this.isConnected = false;
            throw new StreamManagerException(e);
        }
    }

    public List<String> listStreams() throws StreamManagerException {
        if (!this.isConnected) {
            this.connect();
        }
        try {
            return this.client.listStreams();
        } catch (ClientClosedException | ConnectException e) {
            // reconnect
            this.connect();
            return this.client.listStreams();
        }
    }

    public MessageStreamInfo describeStream(String streamName) throws StreamManagerException {
        if (!this.isConnected) {
            this.connect();
        }
        try {
            return this.client.describeMessageStream(streamName);
        } catch (ClientClosedException | ConnectException e) {
            // reconnect
            this.connect();
            return this.client.describeMessageStream(streamName);
        }
    }

    public void deleteMessageStream(String streamName) throws StreamManagerException {
        if (!this.isConnected) {
            this.connect();
        }
        try {
            this.client.deleteMessageStream(streamName);
        } catch (ClientClosedException | ConnectException e) {
            // reconnect
            this.connect();
            this.client.deleteMessageStream(streamName);
        }
    }

    public List<Message> readMessages(String streamName, Long desiredStartSequenceNumber, Long minMessageCount,
                                      Long maxMessageCount, Long readTimeoutMillis) throws StreamManagerException {
        if (!this.isConnected) {
            this.connect();
        }
        try {
            return this.client.readMessages(streamName,
                    new ReadMessagesOptions(desiredStartSequenceNumber, minMessageCount, maxMessageCount,
                            readTimeoutMillis));
        } catch (ClientClosedException | ConnectException e) {
            // reconnect
            this.connect();
            return this.client.readMessages(streamName,
                    new ReadMessagesOptions(desiredStartSequenceNumber, minMessageCount, maxMessageCount,
                            readTimeoutMillis));
        }
    }

    public void appendMessage(String streamName, byte[] message) throws StreamManagerException {
        if (!this.isConnected) {
            this.connect();
        }
        try {
            this.client.appendMessage(streamName, message);
        } catch (ClientClosedException | ConnectException e) {
            // reconnect
            this.connect();
            this.client.appendMessage(streamName, message);
        }
    }

    public void createMessageStream(MessageStreamDefinition messageStream) throws StreamManagerException {
        if (!this.isConnected) {
            this.connect();
        }
        try {
            this.client.createMessageStream(messageStream);
        } catch (ClientClosedException | ConnectException e) {
            // reconnect
            this.connect();
            this.client.createMessageStream(messageStream);
        }
    }

    public void updateMessageStream(MessageStreamDefinition messageStream) throws StreamManagerException {
        if (!this.isConnected) {
            this.connect();
        }
        try {
            this.client.updateMessageStream(messageStream);
        } catch (ClientClosedException | ConnectException e) {
            // reconnect
            this.connect();
            this.client.updateMessageStream(messageStream);
        }
    }
}
