/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component } from "react";
import {Box, ColumnLayout, Container, ContentLayout, Header, SpaceBetween} from "@cloudscape-design/components";
import { SERVER } from "../index";
import { APICall } from "../util/CommUtils";

/**
 * Machine architecture specs
 */
class Arch extends Component {
  state = {
    device: {
      os: "",
      version: "",
      cpu: "",
      rootPath: "",
      logStore: "",
      registered: false,
      thingName: "",
    },
  };

  async componentDidMount() {
    SERVER.sendRequest({ call: APICall.getDeviceDetails, args: [] }).then(
      (response) => {
        this.setState({ device: response });
      },
      (reason) => {
        console.log("Error in [Arch]: " + reason);
      }
    );
  }
  render() {
    const items = [
      [
        {
          field: "Operating system",
          value: this.state.device.os,
        },
        {
          field: "Version",
          value: this.state.device.version,
        },
        {
          field: "CPU architecture",
          value: this.state.device.cpu,
        },
      ],
      [
        {
          field: "Registered with AWS",
          value: this.state.device.registered ? "Yes" : "No",
        },
        { field: "IoT Thing name", value: this.state.device.thingName },
      ],
      [
        {
          field: "Root path",
          value: this.state.device.rootPath,
        },
      ],
      [
        {
          field: "Log store",
          value: this.state.device.logStore,
        },
      ],
    ];

    return (
        <ContentLayout header={<Header variant={"h2"}>Device Details</Header>}>
          <Container>
            <ColumnLayout columns={4} variant="text-grid">
              {items.map((group, index) => (
                  <SpaceBetween size="xs" key={index}>
                    {group.map((item) => (
                        <div key={item.field}>
                          <Box margin={{bottom: "xxxs"}} color="text-label">{item.field}</Box>
                          <div>{item.value}</div>
                        </div>
                    ))}
                  </SpaceBetween>
              ))}
            </ColumnLayout>
          </Container>
        </ContentLayout>
    );
  }
}

export default Arch;
