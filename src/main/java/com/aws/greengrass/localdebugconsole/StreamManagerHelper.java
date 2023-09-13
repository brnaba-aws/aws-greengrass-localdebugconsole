package com.aws.greengrass.localdebugconsole;

import java.lang.reflect.Field;
import java.util.Collections;
import java.util.List;

import com.amazonaws.greengrass.streammanager.client.StreamManagerClientFactory;
import com.amazonaws.greengrass.streammanager.client.config.StreamManagerAuthInfo;
import com.amazonaws.greengrass.streammanager.client.config.StreamManagerClientConfig;
import com.amazonaws.greengrass.streammanager.client.config.StreamManagerServerInfo;
import com.amazonaws.greengrass.streammanager.client.exception.StreamManagerException;
import com.amazonaws.greengrass.streammanager.model.Message;
import com.amazonaws.greengrass.streammanager.model.MessageStreamInfo;
import com.amazonaws.greengrass.streammanager.client.StreamManagerClient;
import com.amazonaws.greengrass.streammanager.model.ReadMessagesOptions;
import com.aws.greengrass.config.Topic;
import com.aws.greengrass.config.Topics;
import com.aws.greengrass.lifecyclemanager.Kernel;
import com.aws.greengrass.logging.api.Logger;
import com.aws.greengrass.logging.impl.LogManager;
import com.aws.greengrass.util.Coerce;

import static com.aws.greengrass.authorization.AuthorizationIPCAgent.STREAM_MANAGER_SERVICE_NAME;
import static com.aws.greengrass.componentmanager.KernelConfigResolver.CONFIGURATION_CONFIG_KEY;

public class StreamManagerHelper {

    private static final String STREAM_MANAGER_PORT_KEY = "STREAM_MANAGER_SERVER_PORT";
    private final Logger logger;
    private StreamManagerClient client;
    private final String streamManagerAuthToken;

    private Boolean isConnected;

    private String streamManagerPort = "8088";

    private final Kernel kernel;

    public StreamManagerHelper(Kernel kernel, String authToken) {
        this.logger = LogManager.getLogger(StreamManagerHelper.class);
        this.streamManagerAuthToken = authToken;
        this.isConnected = false;
        this.kernel = kernel;
    }

    private void connect(){
        try {
            Topics smTopics = this.kernel.findServiceTopic(STREAM_MANAGER_SERVICE_NAME);
            if (smTopics == null) {
                logger.atDebug().log("{} service topic not found", STREAM_MANAGER_SERVICE_NAME);
            } else {
                Topic portTopic = smTopics.find(CONFIGURATION_CONFIG_KEY, STREAM_MANAGER_PORT_KEY);
                if (portTopic == null) {
                    logger.atError().log("Stream Manager's ({}) port information not found", STREAM_MANAGER_SERVICE_NAME);
                } else {
                    this.streamManagerPort = Coerce.toString(portTopic);
                }
            }
            assert this.streamManagerPort != null;
            StreamManagerClientConfig config = StreamManagerClientConfig.builder()
                    .serverInfo(StreamManagerServerInfo.builder().port(Integer.parseInt(this.streamManagerPort)).build()).build();
            StreamManagerAuthInfo authInfo = config.getAuthInfo();
            Field field = authInfo.getClass().getDeclaredField("authToken");
            field.setAccessible(true);
            field.set(authInfo, this.streamManagerAuthToken);

            this.client = StreamManagerClientFactory.standard().withClientConfig(config).build();
            this.isConnected = true;
        }
        catch (Exception e){
            logger.error("StreamManagerHelper.connect:", e);
            this.isConnected = false;
        }
    }

    public List<String> listStreams() {
        if (!this.isConnected) {
            try {
                // Trying to reconnect in case it didn't work at first.
                this.connect();
            }catch (Exception e){
                logger.error("StreamManagerHelper.listStreams:", e);
            }
        }
        if (this.isConnected){
            try {
                return this.client.listStreams();
            }
            catch (Exception e){
                logger.error("StreamManagerHelper.listStreams:", e);
            }
        }
        return Collections.emptyList();
    }
    public MessageStreamInfo describeStream(String streamName) {
        if (!this.isConnected) {
            try {
                // Trying to reconnect in case it didn't work at first.
                this.connect();
            }catch (Exception e){
                logger.error("Unable to connect to Stream Manager:", e);
            }
        }
        if (this.isConnected){
            try {
                return this.client.describeMessageStream(streamName);
            }
            catch (Exception e){
                logger.error("Unable to describe stream:", e);
            }
        }
        return new MessageStreamInfo();
    }

    public void deleteMessageStream(String streamName) throws StreamManagerException {
        if (!this.isConnected) {
            this.connect();
        }
        if (this.isConnected){
            this.client.deleteMessageStream(streamName);
        }
        else {
            throw new StreamManagerException("Connection to Stream Manager failed!");
        }
    }

    public List<Message> readMessages(String streamName, Long desiredStartSequenceNumber, Long minMessageCount, Long maxMessageCount, Long readTimeoutMillis){
        if (!this.isConnected) {
            try {
                // Trying to reconnect in case it didn't work at first.
                this.connect();
            }catch (Exception e){
                logger.error("Unable to connect to Stream Manager:", e);
            }
        }
        if (this.isConnected){
            try {
                return this.client.readMessages(streamName, new ReadMessagesOptions( desiredStartSequenceNumber, minMessageCount, maxMessageCount, readTimeoutMillis));
            }
            catch (Exception e){
                logger.error("Unable to read messages:", e);
            }
        }
        return Collections.emptyList();
    }
}
