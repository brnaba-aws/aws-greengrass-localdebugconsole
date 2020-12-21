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
  Message,
  MessageType,
  PackedRequest,
  Request,
  RequestID,
} from "../util/CommUtils";
import { ComponentItem } from "../util/ComponentItem";

export default class ServerEndpoint {
  portno: number;
  timeout: number; // in seconds
  initReqID: number = -1024;
  conn: WebSocket;

  _connectionPromise: DeferredPromise;

  reqList: Map<RequestID, DeferredPromise> = new Map();
  componentListSubscribers: Set<Function> = new Set();
  dependencyGraphSubscribers: Set<Function> = new Set();
  componentSubscribers: Map<string, Set<Function>> = new Map();
  componentLogSubscribers: Map<string, Set<Function>> = new Map();

  cachedComponentList: ComponentItem[] = [];
  cachedDependencyGraph: Map<string, Dependency[]> = new Map();

  constructor(portno: number, username: string, password: string, timeout: number) {
    this.portno = portno;
    this.timeout = timeout;

    // declare connections
    this.conn = new WebSocket(
      `ws://${window.location.hostname}:${this.portno}`
    );
    this.conn.onmessage = this.messageHandler;

    // initialize connections
    this._connectionPromise = this.deferPromise(() => {});

    this.conn.onopen = () => {
      this.conn.send(
        JSON.stringify({
          requestID: this.initReqID,
          request: {
            call: InternalAPICall.init,
            args: [username, password],
          },
        })
      );
    };
  }

  initConnections() {
    return this._connectionPromise.promise;
  }

  messageHandler = (m: MessageEvent) => {
    let msg: Message = JSON.parse(m.data);
    if (msg.requestID === this.initReqID) {
      this._connectionPromise.resolve();
      return;
    }
    switch (msg.messageType) {
      case MessageType.RESPONSE: {
        this.responseHandler(msg);
        break;
      }
      case MessageType.COMPONENT_LIST: {
        this.listHandler(msg);
        break;
      }
      case MessageType.DEPS_GRAPH: {
        this.depsHandler(msg);
        break;
      }
      case MessageType.COMPONENT_CHANGE: {
        this.componentUpdateHandler(msg);
        break;
      }
      case MessageType.COMPONENT_LOGS: {
        this.logHandler(msg);
        break;
      }
    }
  };

  responseHandler = (msg: Message) => {
    // resolves the promise returned by sendRequest
    //@ts-ignore
    this.reqList.get(msg.requestID).resolve(msg.payload);
  };
  listHandler = (msg: Message) => {
    let list: ComponentItem[] = msg.payload;
    this.cachedComponentList = list;
    this.componentListSubscribers.forEach((callback) => callback(list));
  };
  depsHandler = (msg: Message) => {
    let pre: DepGraphNode[] = msg.payload;
    let graph: Map<string, Dependency[]> = pre.reduce(
      (acc, curr) => acc.set(curr.name, curr.children),
      new Map<string, Dependency[]>()
    );
    this.cachedDependencyGraph = graph;
    this.dependencyGraphSubscribers.forEach((callback) => callback(graph));
  };
  componentUpdateHandler = (msg: Message) => {
    let component: ComponentItem = msg.payload;
    let set = this.componentSubscribers.get(component.name);
    if (set) set.forEach((callback) => callback(component));
  };
  logHandler = (msg: Message) => {
    let log: Log = msg.payload;
    let set = this.componentLogSubscribers.get(log.name);
    if (set) set.forEach((callback) => callback(log));
  };

  /**
   * Sends an API call to the server and returns a promise with the response. See internal http API for a list
   * of available calls.
   * @param request a Request object
   */
  async sendRequest(request: Request): Promise<any> {
    let reqID = requestID();
    let deferredPromise = this.deferRequest({
      requestID: reqID,
      request: request,
    });
    this.reqList.set(reqID, deferredPromise);
    return deferredPromise.race;
  }

  /**
   * Sends a subscription API call to the server (one that reads "subscribeTo..." or "unsubscribeTo...". Returns
   * a promise with the response.
   * @param request a Request object
   * @param messageHandler the callback function that handles subscription pushes
   */
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
        if (pot === undefined || pot.size === 0) {
          this.componentSubscribers.set(
            request.args[0],
            new Set([messageHandler])
          );
          return this.sendRequest(request);
        } else {
          pot.add(messageHandler);
          return Promise.resolve(true);
        }
      }
      case APICall.unsubscribeToComponent: {
        let pot = this.componentSubscribers.get(request.args[0]);
        if (pot !== undefined) {
          pot.delete(messageHandler);
          if (pot.size === 0) {
            return this.sendRequest(request);
          } else {
            return Promise.resolve(true);
          }
        }
        break;
      }
      case APICall.subscribeToComponentLogs: {
        let pot = this.componentLogSubscribers.get(request.args[0]);
        if (pot === undefined || pot.size === 0) {
          this.componentLogSubscribers.set(
            request.args[0],
            new Set([messageHandler])
          );
          return this.sendRequest(request);
        } else {
          pot.add(messageHandler);
          return Promise.resolve(true);
        }
      }
      case APICall.unsubscribeToComponentLogs: {
        let pot = this.componentLogSubscribers.get(request.args[0]);
        if (pot !== undefined) {
          pot.delete(messageHandler);
          if (pot.size === 0) {
            return this.sendRequest(request);
          } else {
            return Promise.resolve(true);
          }
        }
        break;
      }
    }
    return this.sendRequest(request);
  }

  //utility to send a request that can be manually resolved/rejected at a later time
  deferRequest(packedRequest: PackedRequest) {
    return this.deferPromise(() =>
      this.conn.send(JSON.stringify(packedRequest))
    );
  }
  deferPromise(fn: Function) {
    let deferred: DeferredPromise = {
      // @ts-ignore
      promise: null,
      // @ts-ignore
      race: null,
      // @ts-ignore
      resolve: null,
      // @ts-ignore
      reject: null,
    };

    // actual promise
    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
      fn();
    });

    // set timeout to auto-reject after timeout seconds
    let timeout = new Promise((resolve, reject) => {
      let id = setTimeout(() => {
        clearTimeout(id);
        reject(`Request timed out in ${this.timeout} seconds`);
      }, this.timeout * 1000);
    });
    deferred.race = Promise.race([deferred.promise, timeout]);
    return deferred;
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
