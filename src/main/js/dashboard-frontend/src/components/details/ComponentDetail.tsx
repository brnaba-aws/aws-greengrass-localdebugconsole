/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useContext} from "react";
import { ConfigEditor } from "./ConfigEditor";
import DependencyGraph from "./DependencyGraph";
import { useHistory, withRouter } from "react-router-dom";
import { SERVICE_ROUTE_HREF_PREFIX } from "../../util/constNames";
import DetailHeader from "./DetailHeader";
import DetailBody from "./DetailBody";
import {ContentLayout, Grid} from "@cloudscape-design/components";
import {DefaultContext} from "../../index";

function ComponentDetail() {
  let service = useHistory().location.pathname.substring(
    SERVICE_ROUTE_HREF_PREFIX.length - 1
  );

  const defaultContext = useContext(DefaultContext);

  return (
      <ContentLayout header={<DetailHeader service={service}/>}>
          <Grid gridDefinition={[{colspan: {default: 12, l: 12, xl: 12}},
            {colspan: {default: 12, l: 6, xl: 6}}, {
              colspan: {default: 12, l: 6, xl: 6}
            }]}>
            <DetailBody service={service}/>
            <ConfigEditor dark={defaultContext.darkMode!} service={service}/>
            <DependencyGraph rootComponent={service}/>
          </Grid>
      </ContentLayout>
  );
}

export default withRouter(ComponentDetail);
