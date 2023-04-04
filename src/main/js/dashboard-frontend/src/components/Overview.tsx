/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component } from "react";
import ComponentTable from "./ComponentTable";
import { ALL_DEP_GRAPH_NODES } from "../util/constNames";
import DependencyGraph from "./details/DependencyGraph";
import {Grid, Header} from "@cloudscape-design/components";

class Overview extends Component {
  render() {
    return (
      <>
        <Header variant={"h1"}>Local debug console</Header>
        <Grid gridDefinition={[{ colspan: {default: 12, l: 8, xl: 6} }, { colspan: {default: 12, l: 8, xl: 6} }]}>
          <ComponentTable title="Components" />
          <DependencyGraph rootComponent={ALL_DEP_GRAPH_NODES} />
        </Grid>
      </>
    );
  }
}

export default Overview;
