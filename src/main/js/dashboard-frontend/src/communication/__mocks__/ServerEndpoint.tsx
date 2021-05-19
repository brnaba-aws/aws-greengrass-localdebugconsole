/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  APICall,
  DeferredPromise,
  Dependency,
  DepGraphNode,
  InternalAPICall,
  Log,
  Request,
  RequestID,
} from "../../util/CommUtils";
import { ComponentItem } from "../../util/ComponentItem";
import {
  forcePushSerializedGraph,
  fullRangeList,
  mockConfig,
  mockConfigError,
  mockDeviceDetails,
  multipleComponentUpdates,
} from "./mockedData";
import { USER_CREATED } from "../../util/constNames";

export default class ServerEndpoint {
  reqList: Map<RequestID, DeferredPromise> = new Map();
  componentListSubscribers: Set<Function> = new Set();
  dependencyGraphSubscribers: Set<Function> = new Set();
  componentSubscribers: Map<string, Set<Function>> = new Map();
  componentLogSubscribers: Map<string, Set<Function>> = new Map();

  cachedComponentList: ComponentItem[] = [];
  cachedDependencyGraph: Map<string, Dependency[]> = new Map();

  constructor(portno: number, timeout: number) {}

  initConnections() {
    return Promise.resolve();
  }

  listHandler(list: ComponentItem[]) {
    this.cachedComponentList = list;
    this.componentListSubscribers.forEach((callback) => callback(list));
  }
  depsHandler(pre: DepGraphNode[]) {
    let graph: Map<string, Dependency[]> = pre.reduce(
      (acc, curr) => acc.set(curr.name, curr.children),
      new Map<string, Dependency[]>()
    );
    this.cachedDependencyGraph = graph;
    this.dependencyGraphSubscribers.forEach((callback) => callback(graph));
  }
  componentUpdateHandler(component: ComponentItem) {
    let set = this.componentSubscribers.get(component.name);
    if (set !== undefined) set.forEach((callback) => callback(component));
  }
  logHandler = (log: Log) => {
    let set = this.componentLogSubscribers.get(log.name);
    if (set !== undefined) set.forEach((callback) => callback(log));
  };

  // directly handles requests and returns a resolved promise
  async sendRequest(request: Request): Promise<any> {
    console.log("Request message: " + request.call);
    switch (request.call) {
      case APICall.getDeviceDetails: {
        return Promise.resolve(mockDeviceDetails);
      }
      case APICall.getComponentList: {
        return Promise.resolve(fullRangeList);
      }
      case APICall.getComponent: {
        switch (request.args[0]) {
          case IF_config_get_is_successful_THEN_config_is_editable: {
            return {
              name: IF_config_get_is_successful_THEN_config_is_editable,
              version: "-",
              status: "Installed",
              statusIcon: "pending",
              origin: USER_CREATED,
              canStart: true,
              canStop: false,
            };
          }
          case IF_config_get_is_unsuccessful_THEN_an_error_is_displayed: {
            return {
              name: IF_config_get_is_unsuccessful_THEN_an_error_is_displayed,
              version: "-",
              status: "Installed",
              statusIcon: "pending",
              origin: USER_CREATED,
              canStart: true,
              canStop: false,
            };
          }
        }
        break;
      }
      case APICall.getConfig: {
        switch (request.args[0]) {
          case IF_config_get_is_successful_THEN_config_is_editable: {
            return { successful: true, yaml: mockConfig, errorMsg: null };
          }
          case IF_config_get_is_unsuccessful_THEN_an_error_is_displayed: {
            return { successful: false, yaml: null, errorMsg: mockConfigError };
          }
          default: {
            return { successful: false, yaml: null, errorMsg: null };
          }
        }
      }
      case APICall.updateConfig: {
        if (
          request.args[0] ===
          IF_config_get_is_successful_THEN_config_is_editable
        ) {
          return { successful: true, yaml: null, errorMsg: null };
        }
        return { successful: false, yaml: null, errorMsg: null };
      }
      case InternalAPICall.forcePushComponentList: {
        this.forcePushComponentList();
        break;
      }
      case InternalAPICall.forcePushDependencyGraph: {
        this.forcePushDependencyGraph();
        break;
      }
    }
    return Promise.resolve(true);
  }

  // copied from ServerEndpoint class
  async sendSubscriptionMessage(request: Request, messageHandler: Function) {
    switch (request.call) {
      case APICall.subscribeToComponentList: {
        this.componentListSubscribers.add(messageHandler); // subscribe to future pushes
        if (this.cachedComponentList.length === 0) {
          return this.sendRequest({
            call: InternalAPICall.forcePushComponentList,
            args: [],
          });
        } else {
          messageHandler(this.cachedComponentList);
        }
        return Promise.resolve(true);
      }
      case APICall.unsubscribeToComponentList: {
        this.componentListSubscribers.delete(messageHandler);
        return Promise.resolve(true);
      }
      case APICall.subscribeToDependencyGraph: {
        this.dependencyGraphSubscribers.add(messageHandler);
        if (this.cachedDependencyGraph.size === 0) {
          return this.sendRequest({
            call: InternalAPICall.forcePushDependencyGraph,
            args: [],
          });
        } else {
          messageHandler(this.cachedDependencyGraph);
        }
        return Promise.resolve(true);
      }
      case APICall.unsubscribeToDependencyGraph: {
        this.dependencyGraphSubscribers.delete(messageHandler);
        return Promise.resolve(true);
      }
      case APICall.subscribeToComponent: {
        let pot = this.componentSubscribers.get(request.args[0]);
        if (pot === undefined) {
          this.componentSubscribers.set(
            request.args[0],
            new Set([messageHandler])
          );
        } else pot.add(messageHandler);
        break;
      }
      case APICall.unsubscribeToComponent: {
        let pot = this.componentSubscribers.get(request.args[0]);
        if (pot !== undefined) {
          pot.delete(messageHandler);
        }
        break;
      }
      case APICall.subscribeToComponentLogs: {
        let pot = this.componentLogSubscribers.get(request.args[0]);
        if (pot === undefined) {
          this.componentLogSubscribers.set(
            request.args[0],
            new Set([messageHandler])
          );
        } else {
          pot.add(messageHandler);
        }
        break;
      }
      case APICall.unsubscribeToComponentLogs: {
        let pot = this.componentLogSubscribers.get(request.args[0]);
        if (pot !== undefined) {
          pot.delete(messageHandler);
        }
        break;
      }
    }
    return this.sendRequest(request);
  }

  forcePushComponentList() {
    this.listHandler(fullRangeList);
  }

  forcePushDependencyGraph() {
    this.depsHandler(forcePushSerializedGraph);
  }

  pushComponentUpdate(n: number) {
    this.componentUpdateHandler(multipleComponentUpdates[n]);
  }
}

let _counter = 0;
export function requestID(): number {
  if (_counter < Number.MAX_SAFE_INTEGER) {
    _counter++;
    return _counter;
  } else {
    return (_counter = 1);
  }
}

export const IF_config_get_is_successful_THEN_config_is_editable =
  "IF_config_get_is_successful_THEN_config_is_editable";
export const IF_config_get_is_unsuccessful_THEN_an_error_is_displayed =
  "IF_config_get_is_unsuccessful_THEN_an_error_is_displayed";
