/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import "./index.css";
import React, { Component } from "react";
import ReactDOM from "react-dom";

import { HashRouter, Route, Switch, Redirect } from "react-router-dom";
import { routes } from "./navigation/constRoutes";
import NavSideBar from "./navigation/NavSideBar";

import '@awsui/global-styles/index.css';
import { AppLayout } from "@awsui/components-react";
import ServerEndpoint from "./communication/ServerEndpoint";
import Breadcrumbs from "./navigation/Breadcrumbs";
import { SERVICE_ROUTE_HREF_PREFIX } from "./util/constNames";

export var SERVER: ServerEndpoint;

class App extends Component {
  constructor(props: any) {
    super(props);
    // @ts-ignore
    SERVER = new ServerEndpoint(window.WEBSOCKET_PORT, window.USERNAME, window.PASSWORD, 5);
  }

  render() {
    return (
      <HashRouter>
        <AppLayout
          className="app"
          navigation={<NavSideBar />}
          breadcrumbs={<Breadcrumbs />}
          navigationOpen={true}
          toolsHide={true}
          contentType="default"
          content={
            <Switch>
              <Redirect
                exact
                from={SERVICE_ROUTE_HREF_PREFIX.slice(1, -1)}
                to="/"
              />
              {routes.map((route: any, index: any) => (
                <Route
                  exact
                  key={index}
                  path={route.routePath}
                  children={<route.main />}
                />
              ))}
            </Switch>
          }
        />
      </HashRouter>
    );
  }
}

ReactDOM.render(
  <div className="awsui">
    <App />
  </div>,
  document.getElementById("app")
);
