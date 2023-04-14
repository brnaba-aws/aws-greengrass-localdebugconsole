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
import {ComponentItem} from "../util/ComponentItem";
import React, {ReactNode} from "react";
import {CommunicationMessage} from "../util/CommunicationMessage";

export default class ServerEndpoint {
  portno: number;
  timeout: number; // in seconds
  initReqID: number = -1024;
  conn: WebSocket;
  onError: (m: React.ReactNode) => void;

  _connectionPromise: DeferredPromise;

  reqList: Map<RequestID, DeferredPromise> = new Map();
  componentListSubscribers: Set<Function> = new Set();
  dependencyGraphSubscribers: Set<Function> = new Set();
  componentSubscribers: Map<string, Set<Function>> = new Map();
  componentLogSubscribers: Map<string, Set<Function>> = new Map();

  cachedComponentList: ComponentItem[] = [];
  cachedDependencyGraph: Map<string, Dependency[]> = new Map();

  pubSubTopicsSubscribers: Map<string, Set<Function>> = new Map();

  constructor(portno: number, username: string, password: string, timeout: number, onError: (m: ReactNode) => void) {
    this.portno = portno;
    this.timeout = timeout;
    this.onError = onError;

    // declare connections
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    this.conn = new WebSocket(
      `${proto}://${window.location.hostname}:${this.portno}`
    );

    // initialize connections
    this._connectionPromise = this.deferPromise(() => {});

    this.conn.onmessage = this.messageHandler;
    this.conn.onclose = (event) => {
      let reason: ReactNode = "Unknown reason";
      if (event.code === 1001) {
        reason = "Server closed";
      } else if (event.code === 1002) {
        reason = "An endpoint is terminating the connection due to a protocol error";
      } else if (event.code === 1003) {
        reason = "An endpoint is terminating the connection because it has received a type of data it cannot accept.";
      } else if (event.code === 1005) {
        reason = "No status code was actually present.";
      } else if (event.code === 1006) {
        reason = "The connection was closed abnormally.";
      } else if (event.code === 1007) {
        reason = "An endpoint is terminating the connection because it has received data within a message that was not consistent with the type of the message.";
      } else if (event.code === 1008) {
        reason = "An endpoint is terminating the connection because it has received a message that violates its policy.";
      } else if (event.code === 1009) {
        reason = "An endpoint is terminating the connection because it has received a message that is too big for it to process.";
      } else if (event.code === 1010) {
        // Note that this status code is not used by the server, because it can fail the WebSocket handshake instead.
        reason = "An endpoint (client) is terminating the connection because it has expected the server to negotiate" +
            " one or more extension, but the server didn't return them in the response message of the WebSocket handshake. Specifically, the extensions that are needed are: " + event.reason;
      } else if (event.code === 1011) {
        reason = "A server is terminating the connection because it encountered an unexpected condition that prevented it from fulfilling the request.";
      } else if (event.code === 1015) {
        reason = (<>{'The connection was closed due to a failure to perform a TLS handshake'}<br/>Try opening <a
            href={`${window.location.protocol}//${window.location.hostname}:${this.portno}`} target={'_blank'}
            rel={'noreferrer'}>
          {/* eslint-disable-next-line */}
          {window.location.protocol}//{window.location.hostname}:{this.portno}</a> and
          bypass any warnings, then reload this page.
          The WebSocket connection uses the same certificate as this page.</>);
      }

      // Lower codes are normal events which we want to ignore
      if (event.code >= 1001) {
        this._connectionPromise.reject(reason);
        onError(reason);
      }
    }

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
      case MessageType.PUB_SUB_MSG: {
        this.pubSubMessageHandler(msg);
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
  pubSubMessageHandler = (msg: Message) => {
    const pubsubMsg : CommunicationMessage = msg.payload;
    const set = this.pubSubTopicsSubscribers.get(pubsubMsg.subId);
    if (set) set.forEach((callback) => callback(pubsubMsg));
  }

  /**
   * Sends an API call to the server and returns a promise with the response. See internal http API for a list
   * of available calls.
   * @param request a Request object
   * @param reqId optional request ID
   */
  async sendRequest(request: Request, reqId?: RequestID): Promise<any> {
    await this.initConnections();
    if (typeof reqId === "undefined") {
      reqId = requestID();
    }
    if (this.conn.readyState !== this.conn.OPEN) {
      this.onError("WebSocket not connected");
      return;
    }
    let deferredPromise = this.deferRequest({
      requestID: reqId,
      request: request,
    });
    this.reqList.set(reqId, deferredPromise);
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
      case APICall.subscribeToPubSubTopic: {
        const subId = request.args[0].subId;
        const pot = this.pubSubTopicsSubscribers.get(subId);
        if (pot === undefined || pot.size === 0) {
          return this.sendRequest({...request, args: [JSON.stringify(request.args[0])]}).then((r) => {
            // Only store the subscription if the subscribe request succeeds
            if (r === true) {
              this.pubSubTopicsSubscribers.set(
                  subId,
                  new Set([messageHandler])
              );
            }
            return r;
          });
        }

        pot.add(messageHandler);
        return true;
      }
      case APICall.unsubscribeToPubSubTopic: {
        let pot = this.pubSubTopicsSubscribers.get(request.args[0]);
        if (pot === undefined) {
          break;
        }
        pot.delete(messageHandler);
        if (pot.size === 0) {
          return this.sendRequest(request);
        }

        return true;
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
