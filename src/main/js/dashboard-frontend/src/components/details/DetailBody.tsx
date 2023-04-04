/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component } from "react";
import {
  Box,
  ColumnLayout,
  Container,
  Popover, SpaceBetween, StatusIndicator, StatusIndicatorProps
} from "@cloudscape-design/components";
import { ComponentItem } from "../../util/ComponentItem";
import { SERVER } from "../../index";
import { APICall } from "../../util/CommUtils";
import {BoxProps} from "@cloudscape-design/components/box/interfaces";

interface DetailBodyProps {
  service: string;
}
interface DetailBodyState {
  service: ComponentItem;
}
export default class DetailBody extends Component<
  DetailBodyProps,
  DetailBodyState
> {
  state = {
    service: {
      name: "Placeholder",
      version: "-",
      status: "New",
      statusIcon: "pending" as StatusIndicatorProps.Type,
      origin: "User",
      canStart: false,
      canStop: false,
    },
  };
  handleServerPush = (component: ComponentItem) => {
    this.setState({ service: component });
  };

  async componentDidUpdate(
    prevProps: Readonly<DetailBodyProps>,
    prevState: Readonly<DetailBodyState>,
    snapshot?: any
  ) {
    if (prevProps.service !== this.props.service) {
      // update subscription to currently looked at service
      SERVER.sendSubscriptionMessage(
        { call: APICall.unsubscribeToComponent, args: [prevProps.service] },
        this.handleServerPush
      ).catch((reason) => {
        console.log("Error: " + reason);
      });
      SERVER.sendSubscriptionMessage(
        { call: APICall.subscribeToComponent, args: [this.props.service] },
        this.handleServerPush
      ).catch((reason) => {
        console.log("Error: " + reason);
      });
    }
  }
  async componentDidMount() {
    await SERVER.initConnections();
    SERVER.sendSubscriptionMessage(
      { call: APICall.subscribeToComponent, args: [this.props.service] },
      this.handleServerPush
    ).catch((reason) => {
      console.log("Error: " + reason);
    });
  }
  async componentWillUnmount() {
    SERVER.sendSubscriptionMessage(
      { call: APICall.unsubscribeToComponent, args: [this.props.service] },
      this.handleServerPush
    ).catch((reason) => {
      console.log("Error: " + reason);
    });
  }

  render() {
    return (
      <Container header={<h2>Component details</h2>}>
        <ColumnLayout columns={2} variant="text-grid">
          <SpaceBetween size={"l"}>
            <div>
              <Box margin={{bottom: "xxxs"}} color="text-label">Component name</Box>
              <div>{this.state.service.name}</div>
            </div>
            <div>
              <Box margin={{bottom: "xxxs"}} color="text-label">Operating status</Box>
              <Box color={`text-status-${this.state.service.statusIcon}` as BoxProps.Color}>
                <StatusIndicator type={this.state.service.statusIcon} />
                {` ${this.state.service.status}`}
              </Box>
            </div>
          </SpaceBetween>

          <SpaceBetween size={"l"}>
            <div>
              <Box margin={{bottom: "xxxs"}} color="text-label">Version</Box>
              <div>{this.state.service.version}</div>
            </div>
            <div>
              <Popover
                content='Authorship of the component. "Built-In" Components are provided with Greengrass. "User" components are ones you create.'
                header={"Component Origin"}
              >
                Origin
              </Popover>
              <div>{this.state.service.origin}</div>
            </div>
          </SpaceBetween>
        </ColumnLayout>
      </Container>
    );
  }
}
