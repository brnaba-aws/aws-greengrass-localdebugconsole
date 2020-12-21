/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole;

/**
 * Relays information from the kernel communicator to the client interface.
 */
public interface KernelMessagePusher {

    /**
     * Called when the component list is updated in any way.
     */
    void pushComponentListUpdate();

    /**
     * Called whenever an individual component changes.
     * @param name the service name
     */
    void pushComponentChange(String name);

    /**
     * Called when the wireframe dependency graph is updated.
     */
    void pushDependencyGraphUpdate();
}
