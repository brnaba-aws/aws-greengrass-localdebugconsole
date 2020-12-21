/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ConfigEditor } from "./ConfigEditor";
import DependencyGraph from "./DependencyGraph";
import { useHistory, withRouter } from "react-router-dom";
import { SERVICE_ROUTE_HREF_PREFIX } from "../../util/constNames";
import DetailHeader from "./DetailHeader";
import DetailBody from "./DetailBody";

function ComponentDetail() {
  let service = useHistory().location.pathname.substring(
    SERVICE_ROUTE_HREF_PREFIX.length - 1
  );

  return (
    <>
      <DetailHeader service={service} />
      <div className="awsui-grid">
        <div className="awsui-row">
          <div className="col-12 col-l-12 col-xl-12">
            <DetailBody service={service} />
          </div>
          <div className="col-12 col-l-6 col-xl-6">
            <ConfigEditor dark={false} service={service} />
          </div>
          <div className="col-12 col-l-6 col-xl-6">
            <DependencyGraph rootComponent={service} />
          </div>
        </div>
      </div>
    </>
  );
}

export default withRouter(ComponentDetail);
