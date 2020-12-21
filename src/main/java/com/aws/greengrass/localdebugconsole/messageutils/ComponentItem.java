/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole.messageutils;

import com.aws.greengrass.dependency.State;
import com.aws.greengrass.lifecyclemanager.GreengrassService;
import com.aws.greengrass.util.Coerce;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

import static com.aws.greengrass.componentmanager.KernelConfigResolver.VERSION_CONFIG_KEY;

/**
 * Representation of a component (service) that is sent to the client. This is a plug-and-play object that a client can
 * use without needing any extra information.
 */
@EqualsAndHashCode
@AllArgsConstructor
@NoArgsConstructor
@Getter
public class ComponentItem implements Comparable<ComponentItem> {
    private String name;
    private String version;
    private String status;
    // A string representing the UI element to render
    private String statusIcon;
    private String origin;
    private boolean canStart;
    private boolean canStop;

    public ComponentItem(GreengrassService service) {
        name = service.getName();
        String temp = Coerce.toString(service.getConfig().findLeafChild(VERSION_CONFIG_KEY));
        if (temp == null) {
            version = "-";
        } else {
            version = temp;
        }
        State state = service.getState();
        status = state.getName();
        if (!state.isHappy()) {
            statusIcon = "error";
        } else if (state.isRunning()) {
            statusIcon = "in-progress";
        } else if (state.isFunctioningProperly()) {
            statusIcon = "success";
        } else {
            statusIcon = "pending";
        }
        canStart = state.isStartable();
        canStop = state.isStoppable();
        origin = (service.isBuiltin()) ? Origin.BUILTIN.toString() : Origin.USER.toString();
    }

    // for unit testing
    @Override
    public int compareTo(ComponentItem o) {
        return name.compareTo(o.name);
    }
}
