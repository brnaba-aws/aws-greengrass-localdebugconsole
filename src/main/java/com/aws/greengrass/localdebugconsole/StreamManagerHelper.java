package com.aws.greengrass.localdebugconsole;

import java.lang.reflect.Field;
import java.util.Collections;
import java.util.List;

import com.amazonaws.greengrass.streammanager.client.StreamManagerClientFactory;
import com.amazonaws.greengrass.streammanager.client.config.StreamManagerAuthInfo;
import com.amazonaws.greengrass.streammanager.client.config.StreamManagerClientConfig;
import com.amazonaws.greengrass.streammanager.model.Message;
import com.amazonaws.greengrass.streammanager.model.MessageStreamInfo;
import com.amazonaws.greengrass.streammanager.client.StreamManagerClient;
import com.amazonaws.greengrass.streammanager.model.ReadMessagesOptions;
import com.aws.greengrass.logging.api.Logger;
import com.aws.greengrass.logging.impl.LogManager;

public class StreamManagerHelper {

    private final Logger logger;
    private StreamManagerClient client;
    private final String streamManagerAuthToken;

    private Boolean isConnected;

    public StreamManagerHelper(String authToken) {
        this.logger = LogManager.getLogger(StreamManagerHelper.class);
        this.streamManagerAuthToken = authToken;
        this.isConnected = false;
    }

    private void connect(){
        try {
            StreamManagerClientConfig config = StreamManagerClientConfig.builder().build();
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
                logger.error("StreamManagerHelper.listStreams: {}", e);
            }
        }
        if (this.isConnected){
            try {
                return this.client.listStreams();
            }
            catch (Exception e){
                logger.error("StreamManagerHelper.listStreams: {}", e);
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
                logger.error("StreamManagerHelper.describeStream: {}", e);
            }
        }
        if (this.isConnected){
            try {
                return this.client.describeMessageStream(streamName);
            }
            catch (Exception e){
                logger.error("StreamManagerHelper.describeStream: {}", e);
            }
        }
        return new MessageStreamInfo();
    }

    public void deleteMessageStream(String streamName) {
        if (!this.isConnected) {
            try {
                // Trying to reconnect in case it didn't work at first.
                this.connect();
            }catch (Exception e){
                logger.error("StreamManagerHelper.describeStream: {}", e);
            }
        }
        if (this.isConnected){
            try {
                this.client.deleteMessageStream(streamName);
            }
            catch (Exception e){
                logger.error("StreamManagerHelper.deleteMessageStream: {}", e);
            }
        }
    }

    public List<Message> readMessages(String streamName, Long desiredStartSequenceNumber, Long minMessageCount, Long maxMessageCount, Long readTimeoutMillis){
        if (!this.isConnected) {
            try {
                // Trying to reconnect in case it didn't work at first.
                this.connect();
            }catch (Exception e){
                logger.error("StreamManagerHelper.describeStream: {}", e);
            }
        }
        if (this.isConnected){
            try {
                return this.client.readMessages(streamName, new ReadMessagesOptions( desiredStartSequenceNumber, minMessageCount, maxMessageCount, readTimeoutMillis));
            }
            catch (Exception e){
                logger.error("StreamManagerHelper.deleteMessageStream: {}", e);
            }
        }
        return Collections.emptyList();
    }
}
