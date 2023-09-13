export function formatBytes (bytes?: number | null): string {
    if (bytes === null || bytes === undefined) {
      return '-';
    } else if (bytes < 1024) {
      return bytes + ' bytes';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + ' KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    } else {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
};

export function getExportDefinitionType(exportDefinition: ExportDefinition): string {
  const exportTypes: string[] = [];

  if (exportDefinition.kinesis && exportDefinition.kinesis.length > 0) {
    exportTypes.push('Kinesis');
  }
  if (exportDefinition.http && exportDefinition.http.length > 0) {
    exportTypes.push('HTTPS');
  }
  if (exportDefinition.iotAnalytics && exportDefinition.iotAnalytics.length > 0) {
    exportTypes.push('IoT Analytics');
  }
  if (exportDefinition.IotSitewise && exportDefinition.IotSitewise.length > 0) {
    exportTypes.push('IoT Sitewise');
  }
  if (exportDefinition.s3TaskExecutor && exportDefinition.s3TaskExecutor.length > 0) {
    exportTypes.push('S3');
  }

  return exportTypes.join(' - ');
}

export const getElapsedTime = (elapsedtimesec:number) => {
  if (elapsedtimesec > 0) {
      const elapsedSeconds = Math.floor((Date.now() - elapsedtimesec)/1000);
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
      const elapsedHours = Math.floor(elapsedSeconds / 60 / 60);
      
      if (elapsedSeconds < 1) {
        return `Just now`;
      }
      else if (elapsedMinutes < 1) {
        return `${elapsedSeconds} seconds ago`;
      } else if (elapsedMinutes < 60) {
        return `${elapsedMinutes} minute${elapsedMinutes !== 1 ? 's' : ''} ago`;
      } else if (elapsedHours < 24) {
        return `${elapsedHours} hour${elapsedHours !== 1 ? 's' : ''} ago`;
      }
      else {
        const elapsedDays = Math.floor(elapsedHours / 24);
        return `${elapsedDays} day${elapsedDays !== 1 ? 's' : ''} ago`;
      }
  }
  else {
      return '-'
  }
};


interface IoTAnalyticsConfig {
  identifier:string,
  iotChannel:string,
  iotMsgIdPrefix:string,
  batchSize:number,
  batchIntervalMillis:number,
  priority:number,
  startSequenceNumber:number,
  disabled:boolean
}

interface ExportFormat {
  RAW_NOT_BATCHED:0,
  JSON_BATCHED:1
}

interface KinesisConfig {
  identifier:string,
  kinesisStreamName:string,
  batchSize:number,
  batchIntervalMillis:number,
  priority:number,
  startSequenceNumber:number,
  disabled:boolean
}

interface HTTPConfig {
  identifier:string,
  uri:string,
  batchSize:number,
  batchIntervalMillis:number,
  priority:number,
  startSequenceNumber:number,
  disabled:boolean,
  exportFormat:ExportFormat
}

interface IoTSiteWiseConfig {
  identifier:string,
  batchSize:number,
  batchIntervalMillis:number,
  priority:number,
  startSequenceNumber:number,
  disabled:boolean
}

interface StatusLevel {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
}

interface StatusConfig {
  statusLevel:StatusLevel,
  statusStreamName: string
}

interface S3ExportTaskExecutorConfig {
  identifier:string,
  sizeThresholdForMultipartUploadBytes:number,
  priority:number,
  disabled:boolean,
  statusConfig:StatusConfig
}

export enum PersistenceType {
    File,
    Memory
}

export enum StategyType {
    OverwriteOldestData,
    RejectNewData 
}

interface ExportDefinition {
    kinesis: KinesisConfig[];
    http: HTTPConfig[];
    iotAnalytics: IoTAnalyticsConfig[];
    IotSitewise: IoTSiteWiseConfig[];
    s3TaskExecutor: S3ExportTaskExecutorConfig[];
}

interface StorageStatus {
    newestSequenceNumber: number;
    oldestSequenceNumber: number;
    totalBytes: number;
}

interface Definition {
    exportDefinition: ExportDefinition;
    flushOnWrite: boolean;
    maxSize: number;
    name: string;
    persistence: PersistenceType;
    strategyOnFull: StategyType;
    streamSegmentSize: number;
    timeToLiveMillis: number;
}

export interface ExportStatus {
    errorMessage: string;
    exportConfigIdentifier: string;
    exportedBytesFromStream: number;
    exportedMessagesCount: number;
    lastExportTime: number;
    lastExportedSequenceNumber: number;
}

export interface Stream {
    key: number;
    definition: Definition,
    exportStatuses: ExportStatus[],
    storageStatus: StorageStatus
}

export interface StreamManagerComponentConfiguration {
  Version: string;
  JVM_ARGS: string;
  LOG_LEVEL: string;
  STREAM_MANAGER_AUTHENTICATE_CLIENT: string;
  STREAM_MANAGER_EXPORTER_MAX_BANDWIDTH: string;
  STREAM_MANAGER_EXPORTER_THREAD_POOL_SIZE: string;
  STREAM_MANAGER_EXPORTER_S3_DESTINATION_MULTIPART_UPLOAD_MIN_PART_SIZE_BYTES: string;
  STREAM_MANAGER_SERVER_PORT: string;
  STREAM_MANAGER_STORE_ROOT_DIR: string;
}

export interface Message {
  streamName: string;
  sequenceNumber?: number | null; // Use number or null to represent Long or optional
  ingestTime?: number | null; // Use number or null to represent Long or optional
  payload: Uint8Array | null; // Use Uint8Array or null to represent byte[] or optional
}

export interface ResponseMessage {
  successful: boolean
  errorMsg: string
}


export interface MessageStreamDefinition {
  name: string,
  maxSize: number,
  streamSegmentSize: number,
  timeToLiveMillis: number,
  strategyOnFull: StategyType,
  persistence: PersistenceType ,
  flushOnWrite: boolean,
  exportDefinition: ExportDefinition,
}