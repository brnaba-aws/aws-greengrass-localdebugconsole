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

export enum PersistenceType {
    File,
    Memory
}

export enum StategyType {
    OverwriteOldestData,
    RejectNewData 
}

interface ExportDefinition {
    kinesis: any[];
    http: any[];
    iotAnalytics: any[];
    IotSitewise: any[];
    s3TaskExecutor: any[];
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

interface ExportStatus {
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
    exportStatuses: ExportStatus,
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