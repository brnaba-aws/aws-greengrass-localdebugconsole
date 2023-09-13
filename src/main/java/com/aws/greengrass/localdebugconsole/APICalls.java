/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole;

public enum APICalls {

    /**
     * Called by the client on startup to self-identify its sockets.
     */
    init,
    /**
     * Returns details about the device the kernel is running on in the form of a DeviceDetails object.
     */
    getDeviceDetails,

    /**
     * Returns the current component list. This should be used sparingly, and never in lieu of a subscription, since
     * the data may be outdated very quickly, if not immediately.
     */
    getComponentList,

    /**
     * Returns a snapshot of the desired component, or null if no the component does not exist.
     */
    getComponent,

    /**
     * Request start of a component from lifecycle.
     */
    startComponent,

    /**
     * Request stop of a component from lifecycle.
     */
    stopComponent,

    /**
     * Request re-install of a component from lifecycle.
     */
    reinstallComponent,

    /**
     * Utility called to fetch the running config of the provided component.
     */
    getConfig,

    /**
     * Updates the running config of the provided component with the provided YAML string.
     */
    updateConfig,

    /**
     * Adds a subscriber to updates from one component.
     */
    subscribeToComponent,

    /**
     * Removes a subscriber to updates from one component.
     */
    unsubscribeToComponent,

    /**
     * Adds a subscriber to logs from one component.
     */
    subscribeToComponentLogs,

    /**
     * Removes a subscriber to logs from one component.
     */
    unsubscribeToComponentLogs,

    /**
     * Utility called by the client to get the current list of services.
     */
    forcePushComponentList,

    /**
     * Utility called by the client to get the current wireframe dependency graph.
     */
    forcePushDependencyGraph,

    /**
     * Utility called by the client to subscribe to a local IPC topic.
     */
    subscribeToPubSubTopic,

    /**
     * Utility called by the client to publish to a local IPC topic.
     */
    publishToPubSubTopic,

    /**
     * Utility called by the client to unsubscribe to a local IPC topic.
     */
    unsubscribeToPubSubTopic,

    /**
     * Returns the current Stream Manager streams list
     */
    streamManagerListStreams,

    /**
     * Describes a message stream to get metadata including the stream’s definition, size, and exporter statuses.
     */
    streamManagerDescribeStream,

    /**
     * Deletes a message stream based on its name.
     */
    streamManagerDeleteMessageStream,

    /**
     * Read message(s) from a chosen stream with options. If no options are specified it will try to read 1 message from the stream.
     */
    streamManagerReadMessages,

    /**
     * Append a message into the specified message stream.
     */
    streamManagerAppendMessage,

    /**
     * Create a message stream with a given definition.
     */
    streamManagerCreateMessageStream,
}
