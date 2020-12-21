/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DeviceDetails {
  os: string;
  version: string;
  cpu: string;
  rootPath: string;
  logStore: string;
  registered: boolean;
  thingName: string;
}
