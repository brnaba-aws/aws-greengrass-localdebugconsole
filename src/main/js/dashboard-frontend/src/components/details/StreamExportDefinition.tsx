/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component,  } from "react";
import {
  Box,
  Header,
  Container,
  Tabs, SpaceBetween, Table, TableProps
} from "@cloudscape-design/components";
import { 
    ExportDefinition, 
    KinesisConfig, 
    IoTSiteWiseConfig, 
    IoTAnalyticsConfig, 
    HTTPConfig, 
    S3ExportTaskExecutorConfig,
    ExportFormat,
    formatBytes
 } from "../../util/StreamManagerUtils";

interface StreamDefinitionProps {
  exportDefinition: ExportDefinition;
  loadingFlag:boolean
}


const StreamExportDefinition: React.FC<StreamDefinitionProps> = (props) => {

    const {exportDefinition, loadingFlag} = props
    const columnDefinitionsExportDefinitionKinesis: TableProps.ColumnDefinition<KinesisConfig>[] = [
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
            cell: (e:KinesisConfig) => e.batchSize || '-'
        },
        {
            id: "batchInterval",
            header: "Batch interval (ms)",
            cell: (e:KinesisConfig) => e.batchIntervalMillis || '-'
        },
        {
            id: "startSequenceNumber",
            header: "Start sequence number",
            cell: (e:KinesisConfig) => e.startSequenceNumber || '-'
        },
        {
            id: "priority",
            header: "Priority",
            cell: (e:KinesisConfig) => e.priority || '-'
        },
        {
            id: "disabled",
            header: "Disabled",
            cell: (e:KinesisConfig) => (e.disabled && e.disabled === true)?'True':'False'
        }
    ];

    const columnDefinitionsExportDefinitionIoTSiteWise: TableProps.ColumnDefinition<IoTSiteWiseConfig>[] = [
        {
            id: "identifier",
            header: "Identifider",
            cell: (e:IoTSiteWiseConfig) => e.identifier
        },
        {
            id: "batchSize",
            header: "Batch size",
            cell: (e:IoTSiteWiseConfig) => e.batchSize || '-'
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
    ];

    const columnDefinitionsExportDefinitionIoTAnalytics: TableProps.ColumnDefinition<IoTAnalyticsConfig>[] = [
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
            cell: (e:IoTAnalyticsConfig) => e.batchSize || '-'
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
    ];

    const columnDefinitionsExportDefinitionHttp: TableProps.ColumnDefinition<HTTPConfig>[] = [
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
            cell: (e:HTTPConfig) => e.batchSize || '-'
        },
        {
            id: "batchIntervalMillis",
            header: "Batch interval (ms)",
            cell: (e:HTTPConfig) => e.batchIntervalMillis || '-'
        },
        {
            id: "startSequenceNumber",
            header: "Start sequence number",
            cell: (e:HTTPConfig) => e.startSequenceNumber || '-'
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
    ];

    const columnDefinitionsExportDefinitionS3: TableProps.ColumnDefinition<S3ExportTaskExecutorConfig>[] = [
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
            cell: (e:S3ExportTaskExecutorConfig) => e.statusConfig.statusLevel
        },
        {
            id: "streamNameStatusConfig",
            header: "Status config stream name",
            cell: (e:S3ExportTaskExecutorConfig) => e.statusConfig.statusStreamName
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
    ];
    return (
        <>
            <Header
                key={"ExportDefinitionCounterHeader"}
            >
                Export definitions
            </Header>
            {
                (((props.exportDefinition.IotSitewise.length || 0) + 
                (exportDefinition.http.length || 0) +
                (exportDefinition.iotAnalytics.length || 0) +
                (exportDefinition.s3TaskExecutor.length || 0) + 
                (exportDefinition.kinesis.length || 0)) > 0?true:false)&&
                (<Tabs tabs={[
                    {
                        id: "tab31",
                        content:(
                            exportDefinition.kinesis.length?
                            <Table
                                variant="borderless"
                                key={"columnDefinitionsExportDefinitionKinesis"}
                                columnDefinitions={columnDefinitionsExportDefinitionKinesis}
                                sortingDisabled
                                loading={loadingFlag}
                                loadingText="Loading export definitions."
                                items={exportDefinition.kinesis || []}
                                empty={
                                    <Box
                                    margin={{ vertical: "xs" }}
                                    textAlign="center"
                                    color="inherit"
                                    >
                                    <SpaceBetween size="m">
                                        <b>No export statuses.</b>
                                    </SpaceBetween>
                                    </Box>
                                }
                            />:
                            <div>No Kinesis export definition.</div>
                        ),
                        label:"Kinesis"
                    },
                    {
                        id: "tab32",
                        content:(
                            exportDefinition.IotSitewise.length?
                            <Table
                                variant="borderless"
                                key={"columnDefinitionsExportDefinitionIoTSiteWise"}
                                columnDefinitions={columnDefinitionsExportDefinitionIoTSiteWise}
                                sortingDisabled
                                loading={loadingFlag}
                                loadingText="Loading export definitions."
                                items={exportDefinition.IotSitewise || []}
                                empty={
                                    <Box
                                    margin={{ vertical: "xs" }}
                                    textAlign="center"
                                    color="inherit"
                                    >
                                    <SpaceBetween size="m">
                                        <b>No export statuses.</b>
                                    </SpaceBetween>
                                    </Box>
                                }
                            />:
                            <div>No IoT Sitewise export definition.</div>
                        ),
                        label:"IoT Sitewise"
                    },
                    {
                        id: "tab33",
                        content:(
                            exportDefinition.iotAnalytics.length?
                            <Table
                                variant="borderless"
                                key={"columnDefinitionsExportDefinitionIoTAnalytics"}
                                columnDefinitions={columnDefinitionsExportDefinitionIoTAnalytics}
                                sortingDisabled
                                loading={loadingFlag}
                                loadingText="Loading export definitions."
                                items={exportDefinition.iotAnalytics || []}
                                empty={
                                    <Box
                                    margin={{ vertical: "xs" }}
                                    textAlign="center"
                                    color="inherit"
                                    >
                                    <SpaceBetween size="m">
                                        <b>No export statuses.</b>
                                    </SpaceBetween>
                                    </Box>
                                }
                            />:
                            <div>No IoT Analytics export definition.</div>
                        ),
                        label:"IoT analytics"
                    },
                    {
                        id: "tab34",
                        content:(
                                exportDefinition.http.length?
                                <Table
                                    variant="borderless"
                                    key={"columnDefinitionsExportDefinitionHttp"}
                                    columnDefinitions={columnDefinitionsExportDefinitionHttp}
                                    sortingDisabled
                                    loading={loadingFlag}
                                    loadingText="Loading export definitions."
                                    items={exportDefinition.http || []}
                                    empty={
                                        <Box
                                        margin={{ vertical: "xs" }}
                                        textAlign="center"
                                        color="inherit"
                                        >
                                        <SpaceBetween size="m">
                                            <b>No export statuses.</b>
                                        </SpaceBetween>
                                        </Box>
                                    }
                                />:
                                <div>No HTTP export definition.</div>
                        ),
                        label:"HTTP"
                    },
                    {
                        id: "tab35",
                        content:(
                            exportDefinition.s3TaskExecutor.length?
                            <Table
                                variant="borderless"
                                key={"columnDefinitionsExportDefinitionS3"}
                                columnDefinitions={columnDefinitionsExportDefinitionS3}
                                sortingDisabled
                                loading={loadingFlag}
                                loadingText="Loading export definitions."
                                items={exportDefinition.s3TaskExecutor || []}
                                empty={
                                    <Box
                                    margin={{ vertical: "xs" }}
                                    textAlign="center"
                                    color="inherit"
                                    >
                                    <SpaceBetween size="m">
                                        <b>No export statuses.</b>
                                    </SpaceBetween>
                                    </Box>
                                }
                            />:
                            <div>No S3 export definition.</div>
                        ),
                        label:"S3"
                    }
                ]}></Tabs>) 
            }
            {
                (((exportDefinition.IotSitewise.length || 0) + 
                (exportDefinition.http.length || 0) +
                (exportDefinition.iotAnalytics.length || 0) +
                (exportDefinition.s3TaskExecutor.length || 0) + 
                (exportDefinition.kinesis.length || 0)) === 0?true:false)&&
                <div>No export definitions.</div>
            }
        </>
    );
    
}

export default StreamExportDefinition;