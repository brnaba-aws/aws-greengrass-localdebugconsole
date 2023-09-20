/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useContext, useEffect, useState, useReducer} from "react";
import {
  Box,
  Button,
  Header,
  Tabs, 
  SpaceBetween, 
  Table, 
  Modal,
  Form, FormField,
  Input,
  Select, Link
} from "@cloudscape-design/components";
import { 
    KinesisConfig, 
    IoTSiteWiseConfig, 
    IoTAnalyticsConfig, 
    HTTPConfig, 
    S3ExportTaskExecutorConfig,
    ExportFormat,
    formatBytes,
    Stream,
    StatusLevel,
    MessageStreamDefinition,
    statusLevelText,
} from "../../util/StreamManagerUtils";
import { SERVER , DefaultContext} from "../../index";
import { APICall } from "../../util/CommUtils";
import StreamManagerResponseMessage from "../../util/StreamManagerResponseMessage"
import { STREAM_MANAGER_ROUTE_HREF_PREFIX } from "../../util/constNames";
import { useHistory } from "react-router-dom";

interface StreamDefinitionProps {
  loadingFlagProps:boolean
  describeStreamCallbackPros: CallableFunction,
  streamProps: Stream
}

enum ExportDefinitionActionType {
    UPDATE=0,
    ADD=1,
    DELETE=2,
}


const StreamExportDefinition: React.FC<StreamDefinitionProps> = (props) => {

    const {streamProps, loadingFlagProps, describeStreamCallbackPros} = props
    const defaultContext = useContext(DefaultContext); 
    const optionsStatusLevel:any = [
        { label: "Error", value: "0" },
        { label: "Warning", value: "1" },
        { label: "Information", value: "2" },
        { label: "Debug", value: "3" },
        { label: "Trace", value: "4" }
    ];

    const defaultKinesisExportDefinition =  {
                identifier:"kinesis-id",
                kinesisStreamName:"",
                batchSize:500,
                batchIntervalMillis:60000,
                priority:10,
                startSequenceNumber:0,
                disabled:false
    };
    const defaultIotSitewiseExportDefinition =  {
        identifier:"iot-sitewise-id",
        batchSize:10,
        batchIntervalMillis:60000,
        priority:10,
        startSequenceNumber:0,
        disabled:false
    };
    const defaultIotAnalyticsExportDefinition =  {
        identifier:"iot-analytics-id",
        batchSize:500,
        batchIntervalMillis:60000,
        priority:10,
        startSequenceNumber:0,
        disabled:false,
        iotChannel:"iot-analytics-ch",
        iotMsgIdPrefix:"iot-analytics-prefix",
    };
    const defaultHttpExportDefinition =  {
        identifier:"http-id",
        uri:"",
        batchSize:500,
        batchIntervalMillis:60000,
        priority:10,
        startSequenceNumber:0,
        disabled:false,
        exportFormat:ExportFormat.RAW_NOT_BATCHED
    };
    const defaultS3ExportDefinition =  {
        identifier:"s3-id",
        sizeThresholdForMultipartUploadBytes:5242880,
        priority:10,
        disabled:false,
        statusConfig:{
            statusLevel: StatusLevel.ERROR,
            statusStreamName: ''
        }
    };

    const defaultExportDefinition:any = {
        kinesis: defaultKinesisExportDefinition,
        iotAnalytics:defaultIotAnalyticsExportDefinition,
        IotSitewise:defaultIotSitewiseExportDefinition,
        http:defaultHttpExportDefinition,
        s3TaskExecutor:defaultS3ExportDefinition,
    }

    const [updateExportDefinition, dispatch] = useReducer(reducer, 
        defaultExportDefinition
    );

    const [errorUpdateStreamFeedback, setErrorUpdateStreamFeedback] = useState('');
    
    const exportTypes = [{id:"kinesis", name:'kinesis'}, {id:"IotSitewise", name:"IoT Sitewise"}, {id:"iotAnalytics", name:'IoT Analytics'}, {id:"http", name:'http'}, {id:"s3TaskExecutor", name:"S3"}];

    // Usage example
    const initialSelectedItems:any = {};
    exportTypes.forEach((exportType:any) => {
      initialSelectedItems[exportType.id] = [];
    });

    const [viewModalExportDefinitionKinesis, setViewModalExportDefinitionKinesis] = useState(false);
    const [viewModalExportDefinitionIotSiteWise, setViewModalExportDefinitionIotSiteWise] = useState(false);
    const [viewModalExportDefinitioniotAnalytics, setViewModalExportDefinitioniotAnalytics] = useState(false);
    const [viewModalExportDefinitionhttp, setViewModalExportDefinitionhttp] = useState(false);
    const [viewModalExportDefinitions3TaskExecutor, setViewModalExportDefinitions3TaskExecutor] = useState(false);
    const [viewModalConfirmExportDelete, setViewModalConfirmExportDelete] = useState(false);
    const [viewModalAddExportDefinition, setViewModalAddExportDefinition] = useState(false);

    // Initialize selected items for each export type
    const [selectedItems, setSelectedItems] = useState(initialSelectedItems);
    
    type ExportDefinitionColumn = {
        id: string;
        header: string;
        cell: (e: any) => any;
    };

    type ColumnDefinitionsExportDefinition = {
        [key: string]: ExportDefinitionColumn[];
    };
    const columnDefinitionsExportDefinition: ColumnDefinitionsExportDefinition = {
        kinesis: [
            {
                id: "identifier",
                header: "Identifider",
                cell: (e:KinesisConfig) => e.identifier
            },
            {
                id: "kinesisStreamName",
                header: "Kinesis stream name",
                cell: (e:KinesisConfig) => e.kinesisStreamName || 'N/A'
            },
            {
                id: "batchSize",
                header: "Batch size",
                cell: (e:KinesisConfig) => e.batchSize || '500'
            },
            {
                id: "batchInterval",
                header: "Batch interval (ms)",
                cell: (e:KinesisConfig) => e.batchIntervalMillis || '-'
            },
            {
                id: "startSequenceNumber",
                header: "Start sequence number",
                cell: (e:KinesisConfig) => e.startSequenceNumber || '0'
            },
            {
                id: "priority",
                header: "Priority",
                cell: (e:KinesisConfig) => e.priority || '10'
            },
            {
                id: "disabled",
                header: "Disabled",
                cell: (e:KinesisConfig) => (e.disabled && e.disabled === true)?'True':'False'
            }
        ],
        IotSitewise: [
            {
                id: "identifier",
                header: "Identifider",
                cell: (e:IoTSiteWiseConfig) => e.identifier
            },
            {
                id: "batchSize",
                header: "Batch size",
                cell: (e:IoTSiteWiseConfig) => e.batchSize || '10'
            },
            {
                id: "batchInterval",
                header: "Batch interval (ms)",
                cell: (e:IoTSiteWiseConfig) => e.batchIntervalMillis || '-'
            },
            {
                id: "startSequenceNumber",
                header: "Start sequence number",
                cell: (e:IoTSiteWiseConfig) => e.startSequenceNumber || '-'
            },
            {
                id: "priority",
                header: "Priority",
                cell: (e:IoTSiteWiseConfig) => e.priority || '-'
            },
            {
                id: "disabled",
                header: "Disabled",
                cell: (e:IoTSiteWiseConfig) => (e.disabled && e.disabled === true)?'True':'False'
            }
        ],
        iotAnalytics: [
            {
                id: "identifier",
                header: "Identifider",
                cell: (e:IoTAnalyticsConfig) => e.identifier
            },
            {
                id: "iotChannel",
                header: "IoT channel",
                cell: (e:IoTAnalyticsConfig) => e.iotChannel || '-'
            },
            {
                id: "iotMsgIdPrefix",
                header: "Message id prefix",
                cell: (e:IoTAnalyticsConfig) => e.iotMsgIdPrefix || '-'
            },
            {
                id: "batchSize",
                header: "Batch size",
                cell: (e:IoTAnalyticsConfig) => e.batchSize || '100'
            },
            {
                id: "batchIntervalMillis",
                header: "Batch interval (ms)",
                cell: (e:IoTAnalyticsConfig) => e.batchIntervalMillis || '-'
            },
            {
                id: "startSequenceNumber",
                header: "Start sequence number",
                cell: (e:IoTAnalyticsConfig) => e.startSequenceNumber || '-'
            },
            {
                id: "priority",
                header: "Priority",
                cell: (e:IoTAnalyticsConfig) => e.priority || '-'
            },
            {
                id: "disabled",
                header: "Disabled",
                cell: (e:IoTAnalyticsConfig) => (e.disabled && e.disabled === true)?'True':'False'
            }
        ],
        http: [
            {
                id: "identifier",
                header: "Identifider",
                cell: (e:HTTPConfig) => e.identifier
            },
            {
                id: "uri",
                header: "uri",
                cell: (e:HTTPConfig) => e.uri || '-'
            },
            {
                id: "exportFormat",
                header: "Export format",
                cell: (e:HTTPConfig) => e.exportFormat===ExportFormat.RAW_NOT_BATCHED?'RAW_NOT_BATCHED':'JSON_BATCHED' || '-'
            },
            {
                id: "batchSize",
                header: "Batch size",
                cell: (e:HTTPConfig) => e.batchSize || '500'
            },
            {
                id: "batchIntervalMillis",
                header: "Batch interval (ms)",
                cell: (e:HTTPConfig) => e.batchIntervalMillis || '-'
            },
            {
                id: "startSequenceNumber",
                header: "Start sequence number",
                cell: (e:HTTPConfig) => e.startSequenceNumber
            },
            {
                id: "priority",
                header: "Priority",
                cell: (e:HTTPConfig) => e.priority || '-'
            },
            {
                id: "disabled",
                header: "Disabled",
                cell: (e:HTTPConfig) => (e.disabled && e.disabled === true)?'True':'False'
            }
        ],
        s3TaskExecutor: [
            {
                id: "identifier",
                header: "Identifider",
                cell: (e:S3ExportTaskExecutorConfig) => e.identifier
            },
            {
                id: "sizeThresholdForMultipartUploadBytes",
                header: "Size Threshold Multipart Upload",
                cell: (e:S3ExportTaskExecutorConfig) => formatBytes(e.sizeThresholdForMultipartUploadBytes)
            },
            {
                id: "levelStatusConfig",
                header: "Status config level",
                cell: (e:S3ExportTaskExecutorConfig) => statusLevelText[e.statusConfig.statusLevel]
            },
            {
                id: "streamNameStatusConfig",
                header: "Status config stream name",
                cell: (e:S3ExportTaskExecutorConfig) => <Link href={`${STREAM_MANAGER_ROUTE_HREF_PREFIX}${e.statusConfig.statusStreamName}`} onFollow={(f) => describeStreamCallbackPros(e.statusConfig.statusStreamName)} >{e.statusConfig.statusStreamName}</Link>
                
            },
            {
                id: "priority",
                header: "Priority",
                cell: (e:S3ExportTaskExecutorConfig) => e.priority || '-'
            },
            {
                id: "disabled",
                header: "Disabled",
                cell: (e:S3ExportTaskExecutorConfig) => (e.disabled && e.disabled === true)?'True':'False'
            }
        ],
    };

    
    const initialActiveTab = 'kinesis';
    const [activeTab, setActiveTab] = useState(initialActiveTab);
    const exportTabs = exportTypes.map((exportType:any) => ({
      id: `${exportType.id}`,
      content: generateExportContent(exportType.id),
      label: exportType.name,
    }));    

    function onClickAddExportDefinition () {
        console.log('onClickAddExportDefinition');
        setUpdateExportDefinition(activeTab, defaultExportDefinition[activeTab]);
        setViewModalAddExportDefinition(true);
    }

    function onClickDeleteExportDefinition () {
        setViewModalConfirmExportDelete(true);
    }

    function onConfirmDeleteExportDefinition () {
        console.log('onConfirmDeleteExportDefinition');
        setViewModalConfirmExportDelete(false);

        if (selectedItems[activeTab]?.[0]) {
            updateMessageStream(activeTab, selectedItems[activeTab]?.[0], ExportDefinitionActionType.DELETE);
        }
    }

    function onClickUpdateExportDefinition () {  
        const tabToModalMap:any = 
        {
            kinesis: 'kinesis',
            IotSitewise: 'IotSitewise',
            iotAnalytics: 'iotAnalytics',
            http: 'http',
            s3TaskExecutor: 's3TaskExecutor',
        };

        const tabToModalMapSetter:any = {
            kinesis: setViewModalExportDefinitionKinesis,
            IotSitewise: setViewModalExportDefinitionIotSiteWise,
            iotAnalytics: setViewModalExportDefinitioniotAnalytics,
            http: setViewModalExportDefinitionhttp,
            s3TaskExecutor: setViewModalExportDefinitions3TaskExecutor,
          };

        const activeTabKey = tabToModalMap[activeTab];
        if (selectedItems[activeTabKey]?.[0]) {
            const modalSetter:any = tabToModalMapSetter[activeTab];
            if (modalSetter && selectedItems[activeTab]?.[0]) {
                modalSetter(true);
            }
        }
    }

    const  updateMessageStream = (exportType: string, exportDefinition:any, actionType:ExportDefinitionActionType) => {
        const messageStream:MessageStreamDefinition = {
            name: streamProps.messageStreamInfo.definition.name,
            maxSize: streamProps.messageStreamInfo.definition.maxSize,
            streamSegmentSize: streamProps.messageStreamInfo.definition.streamSegmentSize,
            strategyOnFull: streamProps.messageStreamInfo.definition.strategyOnFull,
            persistence: streamProps.messageStreamInfo.definition.persistence, 
            flushOnWrite: streamProps.messageStreamInfo.definition.flushOnWrite,
            exportDefinition: {
                kinesis:[],
                http:[],
                iotAnalytics: [],
                IotSitewise: [],
                s3TaskExecutor: []
            }
        }

        if (actionType !== ExportDefinitionActionType.ADD){
            // Find the index of the item to update
            const kinesisIndexToUpdate:any = streamProps.messageStreamInfo.definition.exportDefinition.kinesis.findIndex(
                (item:KinesisConfig) => item.identifier.toString() === exportDefinition.identifier.toString());

            // Find the index of the item to update
            const iotSitewiseIndexToUpdate:any = streamProps.messageStreamInfo.definition.exportDefinition.IotSitewise.findIndex(
                (item:IoTSiteWiseConfig) => item.identifier.toString() === exportDefinition.identifier.toString());

            // Find the index of the item to update
            const httpIndexToUpdate:any = streamProps.messageStreamInfo.definition.exportDefinition.http.findIndex(
                (item:HTTPConfig) => item.identifier.toString() === exportDefinition.identifier.toString());

            // Find the index of the item to update
            const iotAnalyticsIndexToUpdate:any = streamProps.messageStreamInfo.definition.exportDefinition.iotAnalytics.findIndex(
                (item:IoTAnalyticsConfig) => item.identifier.toString() === exportDefinition.identifier.toString());

            // Find the index of the item to update
            const s3TaskExecutorIndexToUpdate:any = streamProps.messageStreamInfo.definition.exportDefinition.s3TaskExecutor.findIndex(
                (item:S3ExportTaskExecutorConfig) => item.identifier.toString() === exportDefinition.identifier.toString());

            // Check if the identifier was found in kinesis
            if (kinesisIndexToUpdate !== -1) {
                const updatedKinesisExportDefinition:any = {
                    ...streamProps.messageStreamInfo.definition.exportDefinition?.kinesis[kinesisIndexToUpdate],
                    // Update the properties you need here
                    kinesisStreamName:exportDefinition['kinesisStreamName'],
                    batchSize:exportDefinition['batchSize'],
                    ...(exportDefinition['batchSize'] > 0  && {
                        batchSize: exportDefinition['batchSize'],
                    }),
                    ...(exportDefinition['batchIntervalMillis'] > 0 && {
                        batchIntervalMillis: exportDefinition['batchIntervalMillis'],
                    }),
                    priority:exportDefinition['priority'],
                    startSequenceNumber:exportDefinition['startSequenceNumber'],
                    disabled:exportDefinition['disabled']
                };

                messageStream.exportDefinition = {
                    kinesis:[],
                    http:streamProps.messageStreamInfo.definition.exportDefinition.http,
                    iotAnalytics: streamProps.messageStreamInfo.definition.exportDefinition.iotAnalytics,
                    IotSitewise: streamProps.messageStreamInfo.definition.exportDefinition.IotSitewise,
                    s3TaskExecutor: streamProps.messageStreamInfo.definition.exportDefinition.s3TaskExecutor
                }

                // Loop through the list of KinesisConfig objects
                for (const kinesisConfig of streamProps.messageStreamInfo.definition.exportDefinition?.kinesis || []) {
                    if (kinesisConfig.identifier === updatedKinesisExportDefinition.identifier) {
                        // If the identifier matches the predefined one,
                        if (actionType === ExportDefinitionActionType.UPDATE){
                            // push the update export definition
                            messageStream.exportDefinition?.kinesis.push(updatedKinesisExportDefinition);
                        }
                        else if (actionType === ExportDefinitionActionType.DELETE){
                            //don't push anything
                        }
                        else {
                            console.log('unknown actionType');
                        }
                    } else {
                        // If the identifier doesn't match, push the original entity
                        messageStream.exportDefinition?.kinesis.push(kinesisConfig);
                    }
                }
            }
            else if (iotSitewiseIndexToUpdate !== -1){
                const updatedIoTSitewiseExportDefinition:any = {
                    ...streamProps.messageStreamInfo.definition.exportDefinition?.IotSitewise[iotSitewiseIndexToUpdate],
                    // Update the properties you need here
                    batchSize:exportDefinition['batchSize'],
                    ...(exportDefinition['batchSize'] > 0  && {
                        batchSize: exportDefinition['batchSize'],
                    }),
                    ...(exportDefinition['batchIntervalMillis'] > 0 && {
                        batchIntervalMillis: exportDefinition['batchIntervalMillis'],
                    }),
                    priority:exportDefinition['priority'],
                    startSequenceNumber:exportDefinition['startSequenceNumber'],
                    disabled:exportDefinition['disabled']
                };

                messageStream.exportDefinition = {
                    kinesis:streamProps.messageStreamInfo.definition.exportDefinition.kinesis,
                    http:streamProps.messageStreamInfo.definition.exportDefinition.http,
                    iotAnalytics: streamProps.messageStreamInfo.definition.exportDefinition.iotAnalytics,
                    IotSitewise: [],
                    s3TaskExecutor: streamProps.messageStreamInfo.definition.exportDefinition.s3TaskExecutor
                }

                // Loop through the list of IoTSiteWiseConfig objects
                for (const iotSitewiseConfig of streamProps.messageStreamInfo.definition.exportDefinition?.IotSitewise || []) {
                    if (iotSitewiseConfig.identifier === updatedIoTSitewiseExportDefinition.identifier) {
                        // If the identifier matches the predefined one,
                        if (actionType === ExportDefinitionActionType.UPDATE){
                            // push the update export definition
                            messageStream.exportDefinition?.IotSitewise.push(updatedIoTSitewiseExportDefinition);
                        }
                        else if (actionType === ExportDefinitionActionType.DELETE){
                            //don't push anything
                        }
                        else {
                            console.log('unknown actionType');
                        }
                    } else {
                        // If the identifier doesn't match, push the original entity
                        messageStream.exportDefinition?.IotSitewise.push(iotSitewiseConfig);
                    }
                }
            } else if (iotAnalyticsIndexToUpdate !== -1){
                const updatedIotAnalyticsExportDefinition:IoTAnalyticsConfig = {
                    ...streamProps.messageStreamInfo.definition.exportDefinition.iotAnalytics[iotAnalyticsIndexToUpdate],
                    // Update the properties you need here
                    batchSize:exportDefinition['batchSize'],
                    ...(exportDefinition['batchSize'] > 0  && {
                        batchSize: exportDefinition['batchSize'],
                    }),
                    ...(exportDefinition['batchIntervalMillis'] > 0 && {
                        batchIntervalMillis: exportDefinition['batchIntervalMillis'],
                    }),
                    priority:exportDefinition['priority'],
                    startSequenceNumber:exportDefinition['startSequenceNumber'],
                    disabled:exportDefinition['disabled'],
                    iotChannel:exportDefinition['iotChannel'],
                    iotMsgIdPrefix:exportDefinition['iotMsgIdPrefix'],
                };

                messageStream.exportDefinition = {
                    kinesis:streamProps.messageStreamInfo.definition.exportDefinition.kinesis,
                    http:streamProps.messageStreamInfo.definition.exportDefinition.http,
                    iotAnalytics: [],
                    IotSitewise: streamProps.messageStreamInfo.definition.exportDefinition.IotSitewise,
                    s3TaskExecutor: streamProps.messageStreamInfo.definition.exportDefinition.s3TaskExecutor
                }

                // Loop through the list of KinesisConfig objects
                for (const exportConfig of streamProps.messageStreamInfo.definition.exportDefinition.iotAnalytics || []) {
                    if (exportConfig.identifier === updatedIotAnalyticsExportDefinition.identifier) {
                        // If the identifier matches the predefined one,
                        if (actionType === ExportDefinitionActionType.UPDATE){
                            // push the update export definition
                            messageStream.exportDefinition.iotAnalytics.push(updatedIotAnalyticsExportDefinition);
                        }
                        else if (actionType === ExportDefinitionActionType.DELETE){
                            //don't push anything
                        }
                        else {
                            console.log('unknown actionType');
                        }
                    } else {
                        // If the identifier doesn't match, push the original entity
                        messageStream.exportDefinition.iotAnalytics.push(exportConfig);
                    }
                }
            } else if (httpIndexToUpdate !== -1){
                const updatedHttpExportDefinition:any = {
                    ...streamProps.messageStreamInfo.definition.exportDefinition?.http[httpIndexToUpdate],
                    // Update the properties you need here
                    uri: exportDefinition['uri'],
                    exportFormat: exportDefinition['exportFormat'],
                    batchSize:exportDefinition['batchSize'],
                    ...(exportDefinition['batchSize'] > 0  && {
                        batchSize: exportDefinition['batchSize'],
                    }),
                    ...(exportDefinition['batchIntervalMillis'] > 0 && {
                        batchIntervalMillis: exportDefinition['batchIntervalMillis'],
                    }),
                    priority:exportDefinition['priority'],
                    startSequenceNumber:exportDefinition['startSequenceNumber'],
                    disabled:exportDefinition['disabled']
                };

                messageStream.exportDefinition = {
                    kinesis:streamProps.messageStreamInfo.definition.exportDefinition.kinesis,
                    http:[],
                    iotAnalytics: streamProps.messageStreamInfo.definition.exportDefinition.iotAnalytics,
                    IotSitewise: streamProps.messageStreamInfo.definition.exportDefinition.IotSitewise,
                    s3TaskExecutor: streamProps.messageStreamInfo.definition.exportDefinition.s3TaskExecutor
                }

                // Loop through the list of KinesisConfig objects
                for (const exportConfig of streamProps.messageStreamInfo.definition.exportDefinition.http || []) {
                    if (exportConfig.identifier === updatedHttpExportDefinition.identifier) {
                        // If the identifier matches the predefined one,
                        if (actionType === ExportDefinitionActionType.UPDATE){
                            // push the update export definition
                            messageStream.exportDefinition?.http.push(updatedHttpExportDefinition);
                        }
                        else if (actionType === ExportDefinitionActionType.DELETE){
                            //don't push anything
                        }
                        else {
                            console.log('unknown actionType');
                        }
                    } else {
                        // If the identifier doesn't match, push the original entity
                        messageStream.exportDefinition.http.push(exportConfig);
                    }
                }
            } else if (s3TaskExecutorIndexToUpdate !== -1){
                const updatedS3ExportDefinition:any = {
                    ...streamProps.messageStreamInfo.definition.exportDefinition.s3TaskExecutor[s3TaskExecutorIndexToUpdate],
                    // Update the properties you need here
                    priority:exportDefinition['priority'],
                    disabled:exportDefinition['disabled'],
                    sizeThresholdForMultipartUploadBytes:exportDefinition['sizeThresholdForMultipartUploadBytes'],
                    statusConfig:{
                        statusLevel:exportDefinition['statusConfig'].statusLevel,
                        statusStreamName:exportDefinition['statusConfig'].statusStreamName
                    }
                };

                messageStream.exportDefinition = {
                    kinesis:streamProps.messageStreamInfo.definition.exportDefinition.kinesis,
                    http:streamProps.messageStreamInfo.definition.exportDefinition.http,
                    iotAnalytics: streamProps.messageStreamInfo.definition.exportDefinition.iotAnalytics,
                    IotSitewise: streamProps.messageStreamInfo.definition.exportDefinition.IotSitewise,
                    s3TaskExecutor: []
                }

                // Loop through the list of KinesisConfig objects
                for (const exportConfig of streamProps.messageStreamInfo.definition.exportDefinition.s3TaskExecutor || []) {
                    if (exportConfig.identifier === updatedS3ExportDefinition.identifier) {
                        // If the identifier matches the predefined one,
                        if (actionType === ExportDefinitionActionType.UPDATE){
                            // push the update export definition
                            messageStream.exportDefinition.s3TaskExecutor.push(updatedS3ExportDefinition);
                        }
                        else if (actionType === ExportDefinitionActionType.DELETE){
                            //don't push anything
                        }
                        else {
                            console.log('unknown actionType');
                        }
                    } else {
                        // If the identifier doesn't match, push the original entity
                        messageStream.exportDefinition.s3TaskExecutor.push(exportConfig);
                    }
                }
            }
        }
        else {
            const exportTypeToProperty:any = {
                kinesis: 'kinesis',
                IotSitewise: 'IotSitewise',
                iotAnalytics: 'iotAnalytics',
                http: 'http',
                s3TaskExecutor: 's3TaskExecutor',
            };
            const exportProperty = exportTypeToProperty[exportType];

            if (exportProperty) {
                messageStream.exportDefinition = {
                    ...streamProps.messageStreamInfo.definition.exportDefinition,
                    [exportProperty]: [...streamProps.messageStreamInfo.definition.exportDefinition[exportProperty], exportDefinition],
                };
            }
        }

        SERVER.sendRequest({ call: APICall.streamManagerUpdateMessageStream, args: [JSON.stringify(messageStream)] }).then(
            (response:StreamManagerResponseMessage) => 
            {
                if (response.successful === true) {
                    defaultContext.addFlashItem!({
                        type: response.successful === true?'success':'error',
                        header: response.successful === true?streamProps.messageStreamInfo.definition.name + 'has been updated':'Failed to update ' + streamProps.messageStreamInfo.definition.name,
                        content: response.errorMsg
                    });
                    setErrorUpdateStreamFeedback('');
                    onDismiss();
                    describeStreamCallbackPros(streamProps.messageStreamInfo.definition.name);
                } 
                else {
                    if (response.errorMsg){
                        setErrorUpdateStreamFeedback(response.errorMsg);
                    }
                }
            },
            (reason) => {
                console.log("Error in [StreamManager]: " + reason);
            }
        );
    }

    const onClickConfirmUpdateExportDefinition = (isNewDefinition:boolean) => {

        if (isNewDefinition) {
            updateMessageStream(activeTab, updateExportDefinition[activeTab], ExportDefinitionActionType.ADD);
        }
        else {
            updateMessageStream(activeTab, updateExportDefinition[activeTab], ExportDefinitionActionType.UPDATE);
        }
    }

    function setUpdateExportDefinition (exportType:string, exportDefinitionSelected:any) {
        const typeMappings:any = defaultExportDefinition;

        if (typeMappings.hasOwnProperty(exportType)) {
            const typeProperties = typeMappings[exportType];
            
            for (const key in typeProperties) {
                if (exportDefinitionSelected.hasOwnProperty(key)) {
                    dispatch({
                        exportType: exportType,
                        type: key,
                        payload: {[exportType]:{[key]:exportDefinitionSelected[key] || typeProperties[key]}},
                    });
                }
                else {
                    console.log('error')
                }
            }
        } else {
            // Handle the case where exportType is not recognized
            console.error(`Unknown exportType: ${exportType}`);
        }        
    }

    function generateExportContent(exportType:string) {
        if (streamProps.messageStreamInfo.definition.exportDefinition) {
            const exportData = streamProps.messageStreamInfo.definition.exportDefinition[exportType];
        
            if (exportData.length) {
            return (
                <Table
                variant="borderless"
                key={`columnDefinitionsExportDefinition${exportType}`}
                columnDefinitions={columnDefinitionsExportDefinition[exportType]}
                sortingDisabled
                loading={loadingFlagProps}
                selectionType="single"
                selectedItems={selectedItems[exportType]}
                loadingText="Loading export definitions."
                onSelectionChange={(e:any) => {
                    setUpdateExportDefinition(exportType, e.detail.selectedItems[0]);
                    setSelectedItems({
                    ...selectedItems,
                    [exportType]: streamProps.messageStreamInfo.definition.exportDefinition[exportType].filter((s:any) => s.identifier === e.detail.selectedItems[0].identifier),
                    });
                }}
                items={exportData}
                empty={
                    <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
                    <SpaceBetween size="m">
                        <b>No export statuses.</b>
                    </SpaceBetween>
                    </Box>
                }
                />
            );
            } else {
            return (<div>No {exportType} export definition.</div>);
            }
        }
        else{
            return (<div>No {exportType} export definition.</div>);
        }
    }

    const onDismiss = () => {
        const modalStateSetters:any = {
            Kinesis: setViewModalExportDefinitionKinesis,
            IotSiteWise: setViewModalExportDefinitionIotSiteWise,
            iotAnalytics: setViewModalExportDefinitioniotAnalytics,
            http: setViewModalExportDefinitionhttp,
            s3TaskExecutor: setViewModalExportDefinitions3TaskExecutor,
        };
        
        for (const modalName in modalStateSetters) {
            if (modalStateSetters.hasOwnProperty(modalName)) {
                modalStateSetters[modalName](false);
            }
        }
        if (selectedItems[activeTab][0])
        {
            setUpdateExportDefinition(activeTab, defaultExportDefinition[activeTab]);
        }
        else {
            setUpdateExportDefinition(activeTab, defaultExportDefinition[activeTab]);
        }
        setErrorUpdateStreamFeedback('')
        setViewModalConfirmExportDelete(false);
        setViewModalAddExportDefinition(false);
        setSelectedItems(initialSelectedItems);
    }

    useEffect(() => {
    }, [activeTab, streamProps]);

    function reducer(state:any, action:any) {
        const typeMappings:any = {
            kinesis: {
              kinesisStreamName: 'kinesisStreamName',
              identifier: 'identifier',
              batchSize: 'batchSize',
              batchIntervalMillis: 'batchIntervalMillis',
              priority: 'priority',
              startSequenceNumber: 'startSequenceNumber',
              disabled: 'disabled',
            },
            IotSitewise: {
                identifier: 'identifier',
                batchSize: 'batchSize',
                batchIntervalMillis: 'batchIntervalMillis',
                priority: 'priority',
                startSequenceNumber: 'startSequenceNumber',
                disabled: 'disabled',
            },
            iotAnalytics:{
                identifier:"identifier",
                batchSize:'batchSize',
                batchIntervalMillis:'batchIntervalMillis',
                priority:'priority',
                startSequenceNumber:'startSequenceNumber',
                disabled: 'disabled',
                iotChannel:"iotChannel",
                iotMsgIdPrefix:"iotMsgIdPrefix",
            },
            http:{
                exportFormat:"exportFormat",
                identifier: 'identifier',
                batchSize: 'batchSize',
                batchIntervalMillis: 'batchIntervalMillis',
                priority: 'priority',
                startSequenceNumber: 'startSequenceNumber',
                disabled: 'disabled',
                uri:"uri"
            },
            s3TaskExecutor:
            {
                identifier: 'identifier',
                sizeThresholdForMultipartUploadBytes:'sizeThresholdForMultipartUploadBytes',
                priority: 'priority',
                disabled: 'disabled',
                statusConfig:{
                    statusLevel:"statusLevel",
                    statusStreamName: "statusStreamName"
                }
            }
        };

        if (typeMappings.hasOwnProperty(action.exportType)) {
            const actionType = typeMappings[action.exportType][action.type];
            if (actionType) {
                return {
                    ...state,
                    [action.exportType]: {
                      ...state[action.exportType],
                      [action.type]: action.payload[action.exportType][action.type],
                    },
                  };
            } else {
              // Handle the case where action.type is not recognized
              console.error(`Unknown action.type: ${action.type}`);
              return state;
            }
        } else {
            // Handle the case where exportType is not recognized
            console.error(`Unknown exportType: ${action.exportType}`);
            return state;
        }
    }


    const generateExportDefinitionModal = (exportType:string, 
                                            isVisible:boolean, 
                                            headerText:string,
                                            isNewDefinition:boolean,
                                            exportDefinition: any,
                                            updateExportDefinitionError:string,
                                            onClickConfirmUpdateExportDefinition:any,
                                            onDismiss:any) => {

        const isKinesis = exportType === 'kinesis';
        const isS3TaskExecutor = exportType === 's3TaskExecutor';
        const isIotAnalytics = exportType === 'iotAnalytics';
        const isHttp = exportType === 'http';

        try {return (
            <Modal
                key={`ModalUpdateExportDefinition${exportType}${headerText}`}
                onDismiss={onDismiss}
                visible={isVisible}
                size="medium"
                header={headerText}>
                    <Form
                        variant="embedded"
                        actions={
                            <SpaceBetween direction="horizontal" size="xs">
                                <Button 
                                    formAction="none"
                                    variant="link"
                                    ariaDescribedby={"Cancel"}
                                    ariaLabel="Cancel"
                                    onClick={onDismiss}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    loading={false} 
                                    disabled={false}
                                    variant="primary"
                                    ariaDescribedby={"Update"}
                                    ariaLabel="Update"
                                    onClick={ (e:any) => onClickConfirmUpdateExportDefinition(isNewDefinition)}
                                >
                                    {isNewDefinition === true ? 'Add':'Update'}
                                </Button>
                            </SpaceBetween>
                        }
                        errorText={errorUpdateStreamFeedback !== ''? errorUpdateStreamFeedback: false}
                    >
                    <SpaceBetween direction="vertical" size="l">
                        <FormField 
                            label="Export identifier"
                        >
                            <Input
                                value={exportDefinition.identifier}
                                disabled={isNewDefinition===true?false:true}
                                onChange={(event) => setUpdateExportDefinition(exportType, {'identifier':event.detail.value})}
                            />
                        </FormField>
                        
                        {/* Conditional form fields for Kinesis */}
                            {isKinesis && (
                                <>
                                    <FormField 
                                        label="Kinesis stream name"
                                    >
                                        <Input
                                            value={exportDefinition.kinesisStreamName}
                                            onChange={(event) => setUpdateExportDefinition(exportType, {'kinesisStreamName':event.detail.value})}
                                            disabled={false}
                                        />
                                    </FormField>
                                </>
                            )}
                        {/* Conditional form fields for IoT Analytics*/}
                            {isIotAnalytics && (
                                <>
                                    <FormField 
                                        label="IoT Analytics channel"
                                    >
                                        <Input
                                            value={exportDefinition.iotChannel}
                                            onChange={(event) => setUpdateExportDefinition(exportType, {'iotChannel':event.detail.value})}
                                            disabled={false}
                                        />
                                    </FormField>
                                    <FormField 
                                        label="IoT message id prefix"
                                    >
                                        <Input
                                            value={exportDefinition.iotMsgIdPrefix}
                                            onChange={(event) => setUpdateExportDefinition(exportType, {'iotMsgIdPrefix':event.detail.value})}
                                            disabled={false}
                                        />
                                    </FormField>
                                </>
                            )}
                        {/* Conditional form fields for IoT Analytics*/}
                        {isHttp && (
                                <>
                                    <FormField 
                                        label="HTTP Uri"
                                    >
                                        <Input
                                            value={exportDefinition.uri}
                                            onChange={(event) => setUpdateExportDefinition(exportType, {'uri':event.detail.value})}
                                            disabled={false}
                                        />
                                    </FormField>
                                    <FormField 
                                        label="Export format"
                                    >
                                        <Select
                                            options={[
                                                { label: "RAW NOT BATCHED", value: "0" },
                                                { label: "JSON BATCHED", value: "1" }
                                            ]}
                                        selectedOption={exportDefinition.exportFormat===ExportFormat.RAW_NOT_BATCHED?{ label: "RAW NOT BATCHED", value: "0" }:{ label: "JSON BATCHED", value: "1" }}
                                        onChange={({ detail }) => setUpdateExportDefinition(exportType, {'exportFormat':detail.selectedOption.value==="0"?ExportFormat.RAW_NOT_BATCHED:ExportFormat.JSON_BATCHED})}
                                        disabled={false}
                                    />
                                    </FormField>
                                </>
                            )}
                        {isS3TaskExecutor && (
                                <>
                                    <FormField 
                                        label="size Threshold For Multipar tUpload (Bytes)"
                                    >
                                        <Input
                                            value={exportDefinition.sizeThresholdForMultipartUploadBytes}
                                            onChange={(event) => setUpdateExportDefinition(exportType, {'sizeThresholdForMultipartUploadBytes':event.detail.value})}
                                            disabled={false}
                                            step={1024}
                                        />
                                    </FormField>
                                    <FormField 
                                        label="Status stream name"
                                    >
                                        <Input
                                            value={exportDefinition.statusConfig.statusStreamName}
                                            onChange={(event) => setUpdateExportDefinition(exportType, {'statusConfig':{statusLevel:updateExportDefinition[activeTab].statusConfig.statusLevel, statusStreamName:event.detail.value}})}
                                            disabled={false}
                                        />
                                    </FormField>
                                    <FormField 
                                        label="Status level"
                                    >
                                        <Select
                                            options={optionsStatusLevel}
                                            selectedOption={optionsStatusLevel.filter((e:any) => e.value===exportDefinition.statusConfig.statusLevel.toString())[0]}
                                            onChange={({ detail }) => {console.log(parseInt(exportDefinition.statusConfig.statusLevel)); console.log(parseInt(detail.selectedOption.value || "0")); setUpdateExportDefinition(exportType, {'statusConfig':{statusStreamName:updateExportDefinition[activeTab].statusConfig.statusStreamName, statusLevel:parseInt(detail.selectedOption.value || "0")}})}}
                                            disabled={false}
                                        />
                                        
                                    </FormField>
                                    
                                </>
                            )}
                        {/* Common form fields */}
                        {
                            isS3TaskExecutor===false && (
                            <>
                                <FormField 
                                    label="Batch size"
                                >
                                    <Input
                                        value={exportDefinition.batchSize.toString() || '500'}
                                        onChange={(event) => setUpdateExportDefinition(exportType, {'batchSize':parseInt(event.detail.value)})}
                                        disabled={false}
                                        step={1}
                                        inputMode="decimal"
                                        type="number"
                                    />
                                </FormField>
                        
                                <FormField 
                                    constraintText="The time in milliseconds between the earliest un-uploaded message and the current time."
                                    label="Batch interval in ms"
                                >
                                    <Input
                                        value={exportDefinition.batchIntervalMillis.toString() || '0'}
                                        onChange={(event) => setUpdateExportDefinition(exportType, {'batchIntervalMillis':parseInt(event.detail.value)})}
                                        disabled={false}
                                        step={1}
                                        inputMode="decimal"
                                        type="number"
                                    />
                                </FormField>
                                <FormField 
                                    constraintText="The sequence number of the message to use as the starting message in the export. Default is 0."
                                    label="Start sequence number"
                                >
                                    <Input
                                        value={exportDefinition.startSequenceNumber.toString() || '0'}
                                        onChange={(event) => setUpdateExportDefinition(exportType, {'startSequenceNumber':parseInt(event.detail.value)})}
                                        disabled={false}
                                        step={1}
                                        inputMode="decimal"
                                        type="number"
                                    />
                                </FormField>
                            </>
                            )
                        }
                        
                        <FormField 
                            constraintText="Priority for this upload stream. Lower values are higher priority."
                            label="priority"
                        >
                            <Input
                                value={exportDefinition.priority.toString() || '10'}
                                onChange={(event) => setUpdateExportDefinition(exportType, {'priority':parseInt(event.detail.value)})}
                                disabled={false}
                                step={1}
                                inputMode="decimal"
                                type="number"
                            />
                        </FormField>
                        <FormField 
                            constraintText="Priority for this upload stream. Lower values are higher priority."
                            label="disabled"
                        >
                            <Select
                                options={[
                                    { label: "True", value: "0" },
                                    { label: "False", value: "1" }
                                ]}
                            selectedOption={exportDefinition.disabled===true?{ label: "True", value: "0" }:{ label: "False", value: "1" }}
                            onChange={({ detail }) => setUpdateExportDefinition(exportType, {'disabled':detail.selectedOption.label==='True'?true:false})}
                            disabled={false}
                        />
                        </FormField>
                    </SpaceBetween>   
                </Form>             
            </Modal>
        );
            
        } catch (error) {
            console.log(error)
        }

    };

    function generateModalContentKinesis(){
        const isVisble = selectedItems['kinesis'].length>0 && viewModalExportDefinitionKinesis;

        const exportType:string = 'kinesis';
        const headerText:string = 'Update Kinesis export definition';
        return (
            generateExportDefinitionModal(exportType,isVisble,headerText,false,updateExportDefinition[exportType],"",onClickConfirmUpdateExportDefinition,onDismiss)
        );
    }

    function generateModalContentIotSitewise(){
        const isVisble = selectedItems['IotSitewise'].length>0 && viewModalExportDefinitionIotSiteWise;

        const exportType:string = 'IotSitewise';
        const headerText:string = 'Update IoT Sitewise export definition';
        return (
            generateExportDefinitionModal(exportType,isVisble,headerText,false,updateExportDefinition[exportType],"",onClickConfirmUpdateExportDefinition,onDismiss)
        );
    }

    function generateModalContentIotAnalytics(){
        const isVisble = selectedItems['iotAnalytics'].length>0 && viewModalExportDefinitioniotAnalytics;

        const exportType:string = 'iotAnalytics';
        const headerText:string = 'Update IoT Analytics export definition';
        return (
            generateExportDefinitionModal(exportType,isVisble,headerText,false, updateExportDefinition[exportType],"",onClickConfirmUpdateExportDefinition,onDismiss)
        );
    }

    function generateModalContentHttp(){
        const isVisble = selectedItems['http'].length>0 && viewModalExportDefinitionhttp;

        const exportType:string = 'http';
        const headerText:string = 'Update HTTP export definition';
        return (
            generateExportDefinitionModal(exportType,isVisble,headerText, false, updateExportDefinition[exportType],"",onClickConfirmUpdateExportDefinition,onDismiss)
        );
    }

    function generateModalContents3TaskExecutor(){
        const isVisble = selectedItems['s3TaskExecutor'].length>0 && viewModalExportDefinitions3TaskExecutor;
        const exportType:string = 's3TaskExecutor';
        const headerText:string = 'Update S3 export definition';

        return (
            generateExportDefinitionModal(exportType,isVisble,headerText, false , updateExportDefinition[exportType],"", onClickConfirmUpdateExportDefinition, onDismiss)
        );
    }

    function generateModalContentNewExport(){
        const isVisible = viewModalAddExportDefinition;
        const exportType:string = activeTab;
        const headerText = 'Add export definition'

        return (
            generateExportDefinitionModal(exportType, isVisible, headerText, true, updateExportDefinition[exportType],"", onClickConfirmUpdateExportDefinition, onDismiss)
        );
    }

    function generateModalContentDeleteExport(){
        return (
            <Modal
                key={"deleteExportDefinition"}
                onDismiss={ (e) => onDismiss()}
                visible={viewModalConfirmExportDelete}
                size="medium"
                footer={
                    <Box float="right">
                    <SpaceBetween direction="horizontal" size="xs">
                        <Button 
                            variant="link" 
                            onClick={onDismiss}
                            ariaDescribedby={"Cancel"}
                            ariaLabel="Cancel"
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="primary"
                            onClick={onConfirmDeleteExportDefinition}
                            ariaDescribedby={"Delete"}
                            ariaLabel="Delete"
                        >
                            Delete
                        </Button>
                    </SpaceBetween>
                    </Box>
                }
                header={'Delete export definition?'}
                >
                Are you sure you want to delete this export?
            </Modal>
        );
    }
      
      

    // Render export tabs
    return (
        <>
        <Header
            key={"ExportDefinitionCounterHeader"}
            actions={
                <SpaceBetween key={"SpaceBetween1"} direction="horizontal"  size="xs">
                    <Button
                        ariaDescribedby={"Add export"}
                        ariaLabel="Add export" 
                        key={"AddExportButtonHeader"}
                        onClick = {() => {
                            onClickAddExportDefinition();
                        }}
                        iconName="add-plus"
                        wrapText={false}
                        disabled={loadingFlagProps}
                    >
                        Add export
                    </Button>
                
                    <Button
                        ariaDescribedby={"Update export"}
                        ariaLabel="Update export" 
                        key={"UpdateExportButtonHeader"}
                        onClick = {() => {
                            onClickUpdateExportDefinition();
                        }}
                        iconName="edit"
                        wrapText={false}
                        disabled={loadingFlagProps || (selectedItems[activeTab].length===0)}
                    >
                        Update export
                    </Button>
                    {
                    ((streamProps.messageStreamInfo.definition.exportDefinition.IotSitewise.length + streamProps.messageStreamInfo.definition.exportDefinition.kinesis.length +
                        streamProps.messageStreamInfo.definition.exportDefinition.http.length + streamProps.messageStreamInfo.definition.exportDefinition.iotAnalytics.length + streamProps.messageStreamInfo.definition.exportDefinition.s3TaskExecutor.length) > 0)
                    && <Button
                        ariaDescribedby={"Delete export"}
                        ariaLabel="Delete export" 
                        key={"DeleteExportButtonHeader"}
                        onClick = {() => {
                            onClickDeleteExportDefinition();
                        }}
                        iconName="remove"
                        wrapText={false}
                        disabled={loadingFlagProps}
                    >
                        Delete export
                    </Button>}
                </SpaceBetween>
            }
        >
            Export definitions
        </Header>
        {
            <Tabs
                activeTabId={activeTab}
                onChange={(newTab:any) => setActiveTab(newTab.detail.activeTabId)}
                tabs={exportTabs}
            />
        }
        {
            <>
            {generateModalContentKinesis()}
            {generateModalContentIotSitewise()}
            {generateModalContentIotAnalytics()}
            {generateModalContentHttp()}
            {generateModalContents3TaskExecutor()}
            {generateModalContentNewExport()}
            {generateModalContentDeleteExport()}
            </>
        }
    </>
    );
}

export default StreamExportDefinition;