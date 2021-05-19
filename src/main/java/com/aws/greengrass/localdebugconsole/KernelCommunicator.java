/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole;


import com.amazon.aws.iot.greengrass.component.common.DependencyType;
import com.aws.greengrass.config.ChildChanged;
import com.aws.greengrass.config.Node;
import com.aws.greengrass.config.Subscriber;
import com.aws.greengrass.config.Topic;
import com.aws.greengrass.config.UpdateBehaviorTree;
import com.aws.greengrass.config.WhatHappened;
import com.aws.greengrass.dependency.State;
import com.aws.greengrass.deployment.DeviceConfiguration;
import com.aws.greengrass.lifecyclemanager.GreengrassService;
import com.aws.greengrass.lifecyclemanager.Kernel;
import com.aws.greengrass.lifecyclemanager.exceptions.ServiceLoadException;
import com.aws.greengrass.localdebugconsole.messageutils.ComponentItem;
import com.aws.greengrass.localdebugconsole.messageutils.ConfigMessage;
import com.aws.greengrass.localdebugconsole.messageutils.DepGraphNode;
import com.aws.greengrass.localdebugconsole.messageutils.Dependency;
import com.aws.greengrass.localdebugconsole.messageutils.DeviceDetails;
import com.aws.greengrass.logging.api.Logger;
import com.aws.greengrass.logging.impl.config.LogConfig;
import com.aws.greengrass.logging.impl.config.LogStore;
import com.aws.greengrass.util.Coerce;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;

import java.text.MessageFormat;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import javax.inject.Singleton;

import static com.aws.greengrass.componentmanager.KernelConfigResolver.VERSION_CONFIG_KEY;
import static com.aws.greengrass.lifecyclemanager.GreengrassService.PRIVATE_STORE_NAMESPACE_TOPIC;

/**
 * Manages data fetches and streams from the kernel.
 */
@Singleton
public class KernelCommunicator implements DashboardAPI {

    private final Kernel root;
    private KernelMessagePusher server;
    protected final Logger logger;
    private final DeviceConfiguration deviceConfig;
    private static final ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());

    private final ConcurrentHashMap<GreengrassService, Map<GreengrassService, DependencyType>> dependencyGraph =
            new ConcurrentHashMap<>();

    public KernelCommunicator(Kernel root, Logger logger, DeviceConfiguration deviceConfig) {
        this.root = root;
        this.logger = logger;
        this.deviceConfig = deviceConfig;
    }

    void linkWithPusher(KernelMessagePusher server) {
        this.server = server;
    }

    // fetch and subscribe to data streams from the kernel
    void linkWithKernel() {
        root.getContext().addGlobalStateChangeListener(this::onStateChange);
        KernelHook hook = new KernelHook();
        updateNodes(root.getMain(), hook);
        root.getConfig().lookupTopics(GreengrassService.SERVICES_NAMESPACE_TOPIC).subscribe(hook);
        updateServicesList();
    }

    @Override
    public DeviceDetails getDeviceDetails() {
        String thingName = Coerce.toString(deviceConfig.getThingName());
        String storeName =
                (LogConfig.getRootLogConfig().getStore() == LogStore.CONSOLE) ? LogStore.CONSOLE.toString()
                        : LogConfig.getRootLogConfig().getStoreName();
        return new DeviceDetails(System.getProperty("os.name"), System.getProperty("os.version"),
                System.getProperty("os.arch"), root.getNucleusPaths().rootPath().toAbsolutePath().toString(), storeName,
                (thingName != null && !thingName.isEmpty()), thingName);
    }

    @Override
    public synchronized ComponentItem getComponent(String name) {
        try {
            GreengrassService fetched = findService(name);
            return new ComponentItem(fetched);
        } catch (ServiceLoadException e) {
            return null;
        }
    }

    @Override
    public boolean startComponent(String name) {
        try {
            GreengrassService es = findService(name);
            es.requestStart();
            logger.atInfo().log("Requested start from {}", name);
        } catch (ServiceLoadException e) {
            return false;
        }
        return true;
    }

    @Override
    public boolean stopComponent(String name) {
        try {
            GreengrassService es = findService(name);
            es.requestStop();
            logger.atInfo().log("Requested stop from {}", name);
        } catch (ServiceLoadException e) {
            return false;
        }
        return true;
    }

    @Override
    public boolean reinstallComponent(String name) {
        try {
            GreengrassService es = findService(name);
            es.requestReinstall();
            logger.atInfo().log("Requested reinstall from {}", name);
        } catch (ServiceLoadException e) {
            return false;
        }
        return true;
    }

    @Override
    public ConfigMessage getConfig(String component) {
        try {
            return new ConfigMessage(true, yamlMapper.writeValueAsString(findService(component).getConfig().toPOJO()),
                    null);
        } catch (ServiceLoadException e) {
            String msg = MessageFormat.format("Couldn't get config of {0}, service not found", component);
            logger.atError().setCause(e).log(msg);
            return new ConfigMessage(false, null, msg);
        } catch (JsonProcessingException p) {
            String msg = "An error occurred fetching the config YAML";
            logger.atError().setCause(p).log(msg);
            return new ConfigMessage(false, null, msg);
        }
    }

    @Override
    public ConfigMessage updateConfig(String component, String newConfig) {
        try {
            Map<String, UpdateBehaviorTree> privateMerge = new HashMap<>();
            privateMerge.put(PRIVATE_STORE_NAMESPACE_TOPIC,
                    new UpdateBehaviorTree(UpdateBehaviorTree.UpdateBehavior.MERGE, System.currentTimeMillis()));
            findService(component).getConfig()
                    .updateFromMap(yamlMapper.readValue(newConfig, Map.class),
                            new UpdateBehaviorTree(UpdateBehaviorTree.UpdateBehavior.REPLACE, privateMerge,
                                    System.currentTimeMillis()));
            findService(component).getConfig().getContext().waitForPublishQueueToClear();
            return new ConfigMessage(true, null, null);
        } catch (ServiceLoadException e) {
            String msg = MessageFormat.format("Couldn't update config of {0}, service not found", component);
            logger.atError().log(msg);
            return new ConfigMessage(false, null, msg);
        } catch (JsonMappingException j) {
            String msg = "Couldn't map YAML to POJO";
            logger.atError().setCause(j).log(msg);
            return new ConfigMessage(false, null, msg);
        } catch (JsonProcessingException p) {
            String msg = "An error occurred when processing the updated YAML";
            logger.atError().setCause(p).log(msg);
            return new ConfigMessage(false, null, msg);
        }
    }

    @Override
    public synchronized ComponentItem[] getComponentList() {
        return dependencyGraph.keySet().stream().map(ComponentItem::new).toArray(ComponentItem[]::new);
    }

    synchronized void pushDependencyGraphUpdate() {
        server.pushDependencyGraphUpdate();
    }

    @Override
    public synchronized DepGraphNode[] getDependencyGraph() {
        // transforms the dependency graph into the desired return format
        // don't return built-in components
        return dependencyGraph.entrySet().stream().filter(entry -> !entry.getKey().isBuiltin())
                .map(entry -> new DepGraphNode(entry.getKey().getName(),
                        entry.getValue().entrySet().stream().filter(e -> !e.getKey().isBuiltin())
                                .map(e -> new Dependency(e.getKey().getName(),
                                        e.getValue().equals(DependencyType.HARD))).toArray(Dependency[]::new)))
                .toArray(DepGraphNode[]::new);
    }

    /**
     * Updates the dependency tree rooted at a service, inserting nodes and adding listeners where necessary.
     *
     * @param service the service whose dependencies were updated
     * @param hook    the subscriber to attach to the dependencies topic of child nodes
     */
    protected synchronized void updateNodes(GreengrassService service, KernelHook hook) {
        Topic dependencyList = service.getConfig().find(GreengrassService.SERVICE_DEPENDENCIES_NAMESPACE_TOPIC);
        dependencyList.subscribe(hook); // duplicate listeners are not added
        Map<GreengrassService, DependencyType> currDeps = dependencyGraph.get(service);
        if (currDeps == null) { // init
            dependencyGraph.put(service, service.getDependencies());
            for (GreengrassService es : dependencyGraph.get(service).keySet()) {
                updateNodes(es, hook);
            }
        } else { // node already exists
            Map<GreengrassService, DependencyType> hangingDeps = new HashMap<>(currDeps);
            Map<GreengrassService, DependencyType> newDeps = new HashMap<>(service.getDependencies());
            for (GreengrassService es : newDeps.keySet()) {
                hangingDeps.remove(es);
            }

            // symmetric diff
            for (GreengrassService child : hangingDeps.keySet()) {
                currDeps.remove(child);
            }
            for (GreengrassService es : currDeps.keySet()) {
                newDeps.remove(es);
            }
            for (Map.Entry<GreengrassService, DependencyType> entry : newDeps.entrySet()) {
                currDeps.put(entry.getKey(), entry.getValue());
                updateNodes(entry.getKey(), hook); // add watcher to new services
            }
        }
    }

    protected synchronized void removeNode(GreengrassService node) {
        dependencyGraph.remove(node);
    }

    protected GreengrassService findService(String name) throws ServiceLoadException {
        return root.locate(name);
    }


    /**
     * Update only the service list from orderedDependencies. Use this method to update built-in services
     */
    protected void updateServicesList() {
        Set<GreengrassService> newList = new HashSet<>(root.orderedDependencies());

        // symmetric difference
        for (GreengrassService service : newList) {
            dependencyGraph.putIfAbsent(service, new HashMap<>());
        }
        for (GreengrassService service : dependencyGraph.keySet()) {
            if (!newList.contains(service)) {
                removeNode(service);
            }
        }
    }

    void onStateChange(GreengrassService l, State oldState, State newState) {
        server.pushComponentChange(l.getName());
        server.pushComponentListUpdate();
    }

    void onVersionChange(GreengrassService l, String newVersion) {
        server.pushComponentChange(l.getName());
        server.pushComponentListUpdate();
    }


    class KernelHook implements Subscriber, ChildChanged {
        @Override
        public void published(WhatHappened whatHappened, Topic topic) {
            if (GreengrassService.SERVICE_DEPENDENCIES_NAMESPACE_TOPIC.equals(topic.getName())) {
                switch (whatHappened) {
                    case initialized:
                    case changed: {
                        try {
                            GreengrassService modified = findService(Kernel.findServiceForNode(topic));
                            updateNodes(modified, this);
                        } catch (ServiceLoadException e) {
                            logger.atWarn().setCause(e)
                                    .log("Couldn't update dependencies of {}: service not found",
                                            Kernel.findServiceForNode(topic));
                        }
                        break;
                    }
                    case removed: {
                        try {
                            GreengrassService removed = findService(Kernel.findServiceForNode(topic));
                            removeNode(removed);
                        } catch (ServiceLoadException e) {
                            logger.atWarn().setCause(e).log("Couldn't remove {}: service not found",
                                    Kernel.findServiceForNode(topic));
                        }
                        break;
                    }
                }
                pushDependencyGraphUpdate();
            } else if (VERSION_CONFIG_KEY.equals(topic.getName())) {
                try {
                    GreengrassService modified = findService(Kernel.findServiceForNode(topic));
                    onVersionChange(modified, Coerce.toString(topic));
                } catch (ServiceLoadException e) {
                    logger.atWarn().setCause(e).log("Couldn't update version of {}: service not found",
                            Kernel.findServiceForNode(topic));
                }
            }
        }

        @Override
        public void childChanged(WhatHappened whatHappened, Node node) {
            if (node == null) {
                return;
            }
            if (VERSION_CONFIG_KEY.equals(node.getName())) {
                try {
                    GreengrassService modified = findService(Kernel.findServiceForNode(node));
                    onVersionChange(modified, Coerce.toString(node));
                } catch (ServiceLoadException e) {
                    logger.atWarn().setCause(e).log("Couldn't update version of {}: service not found",
                            Kernel.findServiceForNode(node));
                }
            } else {
                updateServicesList();
            }
        }

    }
}
