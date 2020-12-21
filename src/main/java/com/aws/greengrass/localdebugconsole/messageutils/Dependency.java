/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole.messageutils;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * Representation of an edge (dependency on [service]) in the dependency graph.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@EqualsAndHashCode
@ToString
public class Dependency implements Comparable<Dependency> {
    private String name;
    private boolean hard;

    // necessary for unit testing
    @Override
    public int compareTo(Dependency other) {
        if (name.equals(other.name)) {
            return Boolean.compare(hard, other.hard);
        }
        return name.compareTo(other.name);
    }
}
