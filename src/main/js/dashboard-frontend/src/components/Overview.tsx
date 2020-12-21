/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component } from "react";
import ComponentTable from "./ComponentTable";
import { ALL_DEP_GRAPH_NODES } from "../util/constNames";
import DependencyGraph from "./details/DependencyGraph";
import {Header} from "@awsui/components-react";

class Overview extends Component {
  render() {
    return (
      <>
        <Header variant={"h1"}>{`Local debug console`}</Header>
        <div className="awsui-grid">
          <div className="awsui-row">
            <div className="col-12 col-l-8 col-xl-6">
              <ComponentTable title="Components" />
            </div>
            <div className="col-12 col-l-8 col-xl-6">
              <DependencyGraph rootComponent={ALL_DEP_GRAPH_NODES} />
            </div>
          </div>
        </div>
      </>
    );
  }
}

export default Overview;
