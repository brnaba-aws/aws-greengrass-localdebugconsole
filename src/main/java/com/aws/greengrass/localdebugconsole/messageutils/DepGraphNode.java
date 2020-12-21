/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole.messageutils;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.Arrays;

/**
 * Representation of a node (service) in the dependency graph.
 */
@EqualsAndHashCode
@Getter
@NoArgsConstructor
@ToString
public class DepGraphNode implements Comparable<DepGraphNode> {
    private String name;
    private Dependency[] children;

    public DepGraphNode(String name, Dependency[] children) {
        this.name = name;
        this.children = children;
        Arrays.sort(children);
    }

    // necessary for unit testing
    @Override
    public int compareTo(DepGraphNode other) {
        return name.compareTo(other.name);
    }
}
