/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {StatusIndicatorProps} from "@awsui/components-react/status-indicator/internal";

export class ComponentItem {
  name: string;
  version: string;
  status: string;
  statusIcon: StatusIndicatorProps.Type;
  origin: string;
  canStart: boolean;
  canStop: boolean;
  constructor(
    name: string,
    version: string,
    status: string,
    statusIcon: StatusIndicatorProps.Type,
    origin: string,
    canStart: boolean,
    canStop: boolean
  ) {
    this.name = name;
    this.version = version;
    this.status = status;
    this.statusIcon = statusIcon;
    this.origin = origin;
    this.canStart = canStart;
    this.canStop = canStop;
  }
}
