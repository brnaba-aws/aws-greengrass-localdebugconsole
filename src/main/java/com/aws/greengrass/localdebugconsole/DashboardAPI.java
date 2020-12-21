/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole;

import com.aws.greengrass.localdebugconsole.messageutils.ComponentItem;
import com.aws.greengrass.localdebugconsole.messageutils.ConfigMessage;
import com.aws.greengrass.localdebugconsole.messageutils.DepGraphNode;
import com.aws.greengrass.localdebugconsole.messageutils.DeviceDetails;

public interface DashboardAPI {

    DeviceDetails getDeviceDetails();

    /**
     * Method to fetch the basic details of a component.
     *
     * @param name the service name
     * @return the service as a ComponentItem if it exists, null if it doesn't
     */
    ComponentItem getComponent(String name);

    /**
     * Method to request a start from lifecycle. Note the return value does NOT indicate if the start was successful.
     * @param name the service name
     * @return true if the component is found, false if the component does not exist.
     */
    boolean startComponent(String name);

    /**
     * Method to request a stop from lifecycle. Note the return value does NOT indicate if the stop was successful.
     * @param name the service name
     * @return true if the component is found, false if the component does not exist.
     */
    boolean stopComponent(String name);

    /**
     * Method to request a reinstall from lifecycle. Note the return value does NOT indicate if the stop was successful.
     * @param name the service name
     * @return true if the component is found, false if the component does not exist.
     */
    boolean reinstallComponent(String name);

    /**
     * Fetches the running config of a component as a YAML string.
     * @param component the EG service
     * @return A ConfigMessage containing true and a stringified version of the running config (in YAML), or false and
     * null if the service doesn't exist.
     */
    ConfigMessage getConfig(String component);

    /**
     * Replace component's running config with newConfig.
     * @param component the EG service to edit
     * @param newConfig a YAML string representing the desired config.
     * @return A ConfigMessage containing true and null if the update is successful, false and a string error
     * message otherwise.
     */
    ConfigMessage updateConfig(String component, String newConfig);

    /**
     * Method to fetch the entire list of components.
     *
     * @return a list of ComponentItem representing the main service and all descendant dependencies.
     */
    ComponentItem[] getComponentList();

    /**
     * Method to fetch the current wireframe dependency graph.
     *
     * @return an graph in the form of a map of service names to a list of dependencies.
     */
    DepGraphNode[] getDependencyGraph();
}
