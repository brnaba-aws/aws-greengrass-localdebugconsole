/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Dependency,
  DepGraphNode,
  Message,
  MessageType,
} from "../../util/CommUtils";
import { ComponentItem } from "../../util/ComponentItem";
import { DeviceDetails } from "../../util/DeviceDetails";

export const multipleComponentUpdates: ComponentItem[] = [
  {
    name: "test",
    version: "1.0.0",
    status: "New",
    statusIcon: "pending",
    origin: "User",
    canStart: true,
    canStop: true,
  },
  {
    name: "test",
    version: "1.0.0",
    status: "Running",
    statusIcon: "in-progress",
    origin: "User",
    canStart: false,
    canStop: true,
  },
  {
    name: "test",
    version: "1.1.0",
    status: "Finished",
    statusIcon: "success",
    origin: "User",
    canStart: true,
    canStop: false,
  },
];

export const forcePushList: ComponentItem[] = [
  {
    name: "test1",
    version: "0.0.0",
    status: "Running",
    statusIcon: "in-progress",
    origin: "User",
    canStart: false,
    canStop: true,
  },
  {
    name: "test2",
    version: "0.0.0",
    status: "New",
    statusIcon: "pending",
    origin: "Built-In",
    canStart: true,
    canStop: true,
  },
  {
    name: "test3",
    version: "0.0.0",
    status: "Broken",
    statusIcon: "error",
    origin: "User",
    canStart: false,
    canStop: false,
  },
];

export const mockComponentList: ComponentItem[] = [
  {
    name: "test1",
    version: "0.0.0",
    status: "Running",
    statusIcon: "in-progress",
    origin: "User",
    canStart: false,
    canStop: true,
  },
  {
    name: "test2",
    version: "0.0.0",
    status: "New",
    statusIcon: "pending",
    origin: "Built-In",
    canStart: true,
    canStop: true,
  },
];

export const mockDeviceDetails: DeviceDetails = {
  os: "someOS",
  version: "x.yy,zz",
  cpu: "x86_64",
  rootPath: "~",
  logStore: "CONSOLE",
  registered: true,
  thingName: "penguinCookies",
};

export const fullRangeList: ComponentItem[] = [
  {
    name: "test1",
    version: "0.0.0",
    status: "Running",
    statusIcon: "in-progress",
    origin: "User",
    canStart: false,
    canStop: true,
  },
  {
    name: "test2",
    version: "0.0.0",
    status: "New",
    statusIcon: "pending",
    origin: "Built-In",
    canStart: true,
    canStop: true,
  },
  {
    name: "test3",
    version: "0.0.0",
    status: "Finished",
    statusIcon: "success",
    origin: "User",
    canStart: true,
    canStop: false,
  },
  {
    name: "test4",
    version: "0.0.0",
    status: "New",
    statusIcon: "pending",
    origin: "User",
    canStart: true,
    canStop: true,
  },
  {
    name: "test5",
    version: "0.0.0",
    status: "Broken",
    statusIcon: "error",
    origin: "User",
    canStart: false,
    canStop: false,
  },
  {
    name: "test6",
    version: "0.0.0",
    status: "Running",
    statusIcon: "in-progress",
    origin: "Built-In",
    canStart: false,
    canStop: true,
  },
];

export const forcePushSerializedGraph: DepGraphNode[] = [
  {
    name: "test6",
    children: [
      {
        name: "test1",
        hard: true,
      },
      {
        name: "test2",
        hard: true,
      },
    ],
  },
  {
    name: "test1",
    children: [
      {
        name: "test3",
        hard: false,
      },
    ],
  },
  {
    name: "test2",
    children: [],
  },
  {
    name: "test3",
    children: [],
  },
];

export const forcePushGraph: Map<string, Dependency[]> = new Map(
  forcePushSerializedGraph.map((node) => [node.name, node.children])
);

export const mockDepGraph: Map<string, Dependency[]> = new Map([
  ["test", [{ name: "quiz", hard: true }]],
  ["quiz", []],
]);

export const mockConfig: String = `---
service:
  lifecycle:
    run: |-
      multiline
      run
  dependencies:
  - one
  - two
`;
export const mockConfigError: String = "Sample error";
