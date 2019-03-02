import {
    ChildContentRequest,
    Content,
    ContentDeleteRequest,
    ContentDeleteResponse,
    ContentDeleteStatus,
    ContentDetailRequest, ContentExportRequest,
    ContentExportResponse,
    ContentImportRequest,
    ContentImportResponse, ContentMarkerRequest,
    ContentRequest,
    ContentSearchCriteria,
    ContentSearchResult,
    ContentService,
    ContentServiceConfig,
    EcarImportRequest, ExportContentContext,
    HierarchyInfo, ImportContentContext,
    SearchResponse
} from '..';
import {Observable} from 'rxjs';
import {ApiService, Response} from '../../api';
import {ProfileService} from '../../profile';
import {KeyValueStore} from '../../key-value-store';
import {GetContentDetailsHandler} from '../handlers/get-content-details-handler';
import {DbService, ReadQuery} from '../../db';
import {ChildContentsHandler} from '../handlers/get-child-contents-handler';
import {ContentEntry, ContentMarkerEntry} from '../db/schema';
import {ContentUtil} from '../util/content-util';
import {DeleteContentHandler} from '../handlers/delete-content-handler';
import {SearchContentHandler} from '../handlers/search-content-handler';
import {AppConfig} from '../../api/config/app-config';
import {FileService} from '../../util/file/def/file-service';
import {DirectoryEntry, Entry, FileEntry} from '../../util/file';
import {FileUtil} from '../../util/file/util/file-util';
import {ErrorCode, FileExtension} from '../util/content-constants';
import COLUMN_NAME_LOCAL_DATA = ContentEntry.COLUMN_NAME_LOCAL_DATA;
import {GetContentsHandler} from '../handlers/get-contents-handler';
import {ContentMapper} from '../util/content-mapper';
import {ImportNExportHandler} from '../handlers/import-n-export-handler';
import {DeviceInfo} from '../../util/device/def/device-info';
import {CleanTempLoc} from '../handlers/export/clean-temp-loc';
import {CreateContentExportManifest} from '../handlers/export/create-content-export-manifest';
import {WriteManifest} from '../handlers/export/write-manifest';
import {CompressContent} from '../handlers/export/compress-content';
import {ZipService} from '../../util/zip/def/zip-service';
import {DeviceMemoryCheck} from '../handlers/import/device-memory-check';
import {CopyAsset} from '../handlers/export/copy-asset';
import {EcarBundle} from '../handlers/export/ecar-bundle';
import {DeleteTempEcar} from '../handlers/export/delete-temp-ecar';
import {AddTransferTelemetryExport} from '../handlers/export/add-transfer-telemetry-export';
import {ExtractEcar} from '../handlers/import/extract-ecar';
import {ValidateEcar} from '../handlers/import/validate-ecar';
import {ExtractPayloads} from '../handlers/import/extract-payloads';
import {CreateContentImportManifest} from '../handlers/import/create-content-import-manifest';
import {EcarCleanup} from '../handlers/import/ecar-cleanup';
import {TelemetryService} from '../../telemetry';
import {UpdateSizeOnDevice} from '../handlers/import/update-size-on-device';
import {GenerateShareEvnet} from '../handlers/import/generate-share-evnet';

export class ContentServiceImpl implements ContentService {
    constructor(private contentServiceConfig: ContentServiceConfig,
                private apiService: ApiService,
                private dbService: DbService,
                private profileService: ProfileService,
                private appConfig: AppConfig,
                private keyValueStore: KeyValueStore,
                private fileService: FileService,
                private zipService: ZipService,
                private deviceInfo: DeviceInfo,
                private telemetryService: TelemetryService) {
    }

    getContentDetails(request: ContentDetailRequest): Observable<Content> {
        return new GetContentDetailsHandler(
            this.dbService, this.contentServiceConfig, this.apiService).handle(request);
    }

    getContents(request: ContentRequest): Observable<Content[]> {
        const query = new GetContentsHandler().getAllLocalContentQuery(request);
        return this.dbService.execute(query).map((contentsInDb: ContentEntry.SchemaMap[]) => {
            return contentsInDb.map((contentInDb: ContentEntry.SchemaMap) =>
                ContentMapper.mapContentDBEntryToContent(contentInDb));
        });
    }

    cancelImport(contentId: string) {
        // TODO
        throw new Error('Not Implemented yet');
    }

    deleteContent(contentDeleteRequest: ContentDeleteRequest): Observable<ContentDeleteResponse[]> {
        const contentDeleteResponse: ContentDeleteResponse[] = [];
        const getContentsHandler = new GetContentDetailsHandler(this.dbService);
        const deleteContentHandler = new DeleteContentHandler(this.dbService);
        contentDeleteRequest.contentDeleteList.forEach(async (contentDelete) => {
            const contentInDb: ContentEntry.SchemaMap[] = await getContentsHandler.getContentFromDB(contentDelete.contentId);
            if (contentInDb && contentInDb[0]) {
                contentDeleteResponse.push({
                    identifier: contentDelete.contentId,
                    status: ContentDeleteStatus.DELETED_SUCCESSFULLY
                });

                if (ContentUtil.hasChildren(contentInDb[0][COLUMN_NAME_LOCAL_DATA])) {
                    await deleteContentHandler.deleteAllChildren(contentInDb[0], contentDelete.isChildContent);
                }

                await deleteContentHandler.deleteOrUpdateContent(contentInDb[0], false, contentDelete.isChildContent);

            } else {
                contentDeleteResponse.push({
                    identifier: contentDelete.contentId,
                    status: ContentDeleteStatus.NOT_FOUND
                });
            }
        });

        return Observable.of(contentDeleteResponse);
    }

    exportContent(contentExportRequest: ContentExportRequest): Observable<Response> {
        const response: Response = new Response();
        if (!contentExportRequest.contentIds.length) {
            response.body = ErrorCode.EXPORT_FAILED_NOTHING_TO_EXPORT;
            return Observable.of(response);
        }
        return Observable.of(response);
        // let fileName;
        // let exportContentContext: ExportContentContext;
        // return new ImportNExportHandler(this.deviceInfo, this.dbService).findAllContentsWithIdentifiers(contentExportRequest.contentIds).then
        // ((contentsInDb) => {
        //     const metaData: { [key: string]: any } = {};
        //     fileName = ContentUtil.getExportedFileName(contentsInDb);
        //     metaData.content_count = contentsInDb.length;
        //     exportContentContext = {
        //         metadata: metaData,
        //         destinationFolder: contentExportRequest.destinationFolder,
        //         contentModelsToExport: contentsInDb
        //     };
        //     return this.fileService.getTempLocation(contentExportRequest.destinationFolder);
        // }).then((directory: DirectoryEntry) => {
        //     return this.fileService.createFile(directory.toURL(), fileName, true);
        // }).then((fileEntry: FileEntry) => {
        //     exportContentContext.ecarFilePath = fileEntry.toURL();
        //     return new CleanTempLoc(this.fileService).execute(exportContentContext);
        // }).then((exportResponse: Response) => {
        // }).then((exportResponse: Response) => {
        //     return new WriteManifest(this.fileService).execute(exportResponse.body);
        // }).then((exportResponse: Response) => {
        //     return new CompressContent(this.zipService, this.fileService).execute(exportResponse.body);
        // }).then((exportResponse: Response) => {
        //     return new DeviceMemoryCheck(this.fileService).execute(exportResponse.body);
        // }).then((exportResponse: Response) => {
        //     return new CopyAsset(this.fileService).execute(exportResponse.body);
        // }).then((exportResponse: Response) => {
        //     return new EcarBundle(this.fileService, this.zipService).execute(exportResponse.body);
        // }).then((exportResponse: Response) => {
        //     return new DeleteTempEcar(this.fileService).execute(exportResponse.body);
        // }).then((exportResponse: Response) => {
        //     return new AddTransferTelemetryExport().execute(exportResponse.body);
        // }).then((exportResponse: Response) => {
        //     return Observable.of(exportResponse);
        // }).catch((exportResponse: Response) => {
        //     return Observable.of(exportResponse);
        // });

    }

    getChildContents(childContentRequest: ChildContentRequest): Observable<any> {
        const childContentHandler = new ChildContentsHandler(this.dbService);
        let hierarchyInfoList: HierarchyInfo[] = childContentRequest.hierarchyInfo;
        if (!hierarchyInfoList) {
            hierarchyInfoList = [];
        } else if (hierarchyInfoList.length > 0) {
            if (hierarchyInfoList[hierarchyInfoList.length - 1].identifier === childContentRequest.contentId) {
                const length = hierarchyInfoList.length;
                hierarchyInfoList.splice((length - 1), 1);
            }
        }

        return this.dbService.read(GetContentDetailsHandler.getReadContentQuery(childContentRequest.contentId))
            .mergeMap((rows: ContentEntry.SchemaMap[]) => {
                return childContentHandler.fetchChildrenOfContent(rows[0], 0, childContentRequest.level, hierarchyInfoList);
            });
    }

    getDownloadState(): Promise<any> {
        // TODO
        throw new Error('Not Implemented yet');
    }

    importContent(contentImportRequest: ContentImportRequest): Observable<any> {
        // TODO
        throw new Error('Not Implemented yet');
    }

    importEcar(ecarImportRequest: EcarImportRequest): Observable<Response> {

        return Observable.fromPromise(this.fileService.exists(ecarImportRequest.sourceFilePath).then((entry: Entry) => {
            const importContentContext: ImportContentContext = {
                isChildContent: ecarImportRequest.isChildContent,
                ecarFilePath: ecarImportRequest.sourceFilePath,
                destinationFolder: ecarImportRequest.destinationFolder
            };
            return this.fileService.getTempLocation(ecarImportRequest.destinationFolder).then((tempLocation: DirectoryEntry) => {
                importContentContext.tmpLocation = tempLocation.nativeURL;
                return new ExtractEcar(this.fileService, this.zipService).execute(importContentContext);
            }).then((importResponse: Response) => {
                console.log('importtresponse extract ecar', importResponse.body);
                return new ValidateEcar(this.fileService, this.dbService, this.appConfig).execute(importResponse.body);
            }).then((importResponse: Response) => {
                console.log('importtresponse validate ecar', importResponse.body);
                return new ExtractPayloads(this.fileService, this.zipService, this.appConfig,
                    this.dbService, this.deviceInfo).execute(importResponse.body);
            }).then((importResponse: Response) => {
                const response: Response = new Response();
                console.log('importtresponse validate ecar', importResponse.body);
                return new CreateContentImportManifest(this.dbService, this.deviceInfo, this.fileService).execute(importResponse.body);
            }).then((importResponse: Response) => {
                console.log('importtresponse CreateContentImportManifest', importResponse.body);
                return new EcarCleanup(this.fileService).execute(importResponse.body);
            }).then((importResponse: Response) => {
                console.log('importtresponse EcarCleanUp', importResponse.body);
                return new UpdateSizeOnDevice(this.dbService).execute(importResponse.body);
            }).then((importResponse: Response) => {
                console.log('importtresponse EcarCleanUp', importResponse.body);
                return new GenerateShareEvnet(this.telemetryService).execute(importResponse.body);
            }).then((importResponse: Response) => {
                const response: Response = new Response();
                console.log('importtresponse ', importResponse.body);
                response.errorMesg = importResponse.errorMesg;
                return response;
            });
        }).catch((error) => {
            console.log('error', error);
            const response: Response = new Response();
            response.errorMesg = ErrorCode.ECAR_NOT_FOUND.valueOf();
            return response;
        }));
        // const importContentContext: ImportContentContext = {
        //     isChildContent: ecarImportRequest.isChildContent,
        //     ecarFilePath: ecarImportRequest.sourceFilePath,
        //     destinationFolder: ecarImportRequest.destinationFolder
        // };
        // return this.fileService.getTempLocation(ecarImportRequest.destinationFolder).then((destinationPath) => {
        //     return new DeviceMemoryCheck(this.fileService).execute(importContentContext);
        // }).then((importResponse: Response) => {
        //     return new ExtractEcar(this.fileService, this.zipService).execute(importResponse.body);
        // }).then((importResponse: Response<ContentImportResponse>) => {
        //     return Observable.of(importResponse.body);
        // }).catch(() => {
        //     const response: Response = new Response();
        //     response.errorMesg = ErrorCode.ECAR_NOT_FOUND.valueOf();
        //     return Observable.of(response);
        // });

        // this.fileService.exists(ecarImportRequest.sourceFilePath).then((entry: Entry) => {
        //     if (FileUtil.getFileExtension(ecarImportRequest.sourceFilePath) !== FileExtension.CONTENT) {
        //         const response: Response = new Response();
        //         response.errorMesg = ErrorCode.ECAR_NOT_FOUND.valueOf();
        //         return Observable.of(response);
        //     } else {
        //         const importContentContext: ImportContentContext = {
        //             isChildContent: ecarImportRequest.isChildContent,
        //             ecarFilePath: ecarImportRequest.sourceFilePath,
        //             destinationFolder: ecarImportRequest.destinationFolder
        //         };
        //         return this.fileService.getTempLocation(ecarImportRequest.destinationFolder).then((destinationPath) => {
        //             return new DeviceMemoryCheck(this.fileService).execute(importContentContext);
        //         }).then((importResponse: Response) => {
        //             return new ExtractEcar(this.fileService, this.zipService).execute(importResponse.body);
        //         }).then((importResponse: Response<ContentImportResponse>) => {
        //             return Observable.of(importResponse.body);
        //         });
        //
        //     }
        //
        // }).catch((error) => {
        //
        // });


        // throw new Error('Not Implemented yet');
    }

    nextContent(hierarchyInfo: HierarchyInfo[], currentContentIdentifier: string): Observable<Content> {
        const childContentHandler = new ChildContentsHandler(this.dbService);
        return this.dbService.read(GetContentDetailsHandler.getReadContentQuery(hierarchyInfo[0].identifier))
            .mergeMap(async (rows: ContentEntry.SchemaMap[]) => {
                const contentKeyList = await childContentHandler.getContentsKeyList(rows[0]);

                return childContentHandler.getNextContentFromDB(hierarchyInfo,
                    currentContentIdentifier,
                    contentKeyList);
            });
    }

    prevContent(hierarchyInfo: HierarchyInfo[], currentContentIdentifier: string): Observable<Content> {
        const childContentHandler = new ChildContentsHandler(this.dbService);
        return this.dbService.read(GetContentDetailsHandler.getReadContentQuery(hierarchyInfo[0].identifier))
            .mergeMap(async (rows: ContentEntry.SchemaMap[]) => {
                const contentKeyList = await childContentHandler.getContentsKeyList(rows[0]);

                return childContentHandler.getNextContentFromDB(hierarchyInfo,
                    currentContentIdentifier,
                    contentKeyList);
            });
    }

    subscribeForImportStatus(contentId: string): Observable<any> {
        // TODO
        throw new Error('Not Implemented yet');
    }


    searchContent(request: ContentSearchCriteria): Observable<ContentSearchResult> {
        const searchHandler: SearchContentHandler = new SearchContentHandler(this.appConfig,
            this.contentServiceConfig);
        const searchRequest = searchHandler.getSearchRequest(request);
        const httpRequest = searchHandler.getRequest(searchRequest, request.framework, request.languageCode);
        return this.apiService.fetch<SearchResponse>(httpRequest)
            .mergeMap((response: Response<SearchResponse>) => {
                return Observable.of(searchHandler.mapSearchResponse(response.body, searchRequest));
            });

    }

    cancelDownload(contentId: string): Observable<undefined> {
        // TODO
        throw new Error('Not Implemented yet');
    }

    setContentMarker(contentMarkerRequest: ContentMarkerRequest): Observable<boolean> {
        const query = `SELECT * FROM ${ContentMarkerEntry.TABLE_NAME} WHERE
 ${ContentMarkerEntry.COLUMN_NAME_UID} = ${contentMarkerRequest.uid} AND ${ContentMarkerEntry.COLUMN_NAME_CONTENT_IDENTIFIER}
 =${contentMarkerRequest.contentId} AND ${ContentMarkerEntry.COLUMN_NAME_MARKER} = ${contentMarkerRequest.marker}`;
        return this.dbService.execute(query).mergeMap((contentMarker) => {

            const markerModel: ContentMarkerEntry.SchemaMap = {
                uid: contentMarkerRequest.uid,
                identifier: contentMarkerRequest.contentId,
                epoch_timestamp: Date.now(),
                data: contentMarkerRequest.data,
                extra_info: JSON.stringify(contentMarkerRequest.extraInfo),
                marker: contentMarkerRequest.marker
            };
            if (!contentMarker) {
                return this.dbService.insert({
                    table: ContentMarkerEntry.TABLE_NAME,
                    modelJson: markerModel
                }).map(v => v > 0);
            } else {
                if (contentMarkerRequest.isMarked) {
                    return this.dbService.update({
                        table: ContentMarkerEntry.TABLE_NAME,
                        modelJson: markerModel
                    });
                } else {
                    return this.dbService.delete({
                        table: ContentMarkerEntry.TABLE_NAME,
                        selection: `${ContentMarkerEntry.COLUMN_NAME_UID} = ? AND ${ContentMarkerEntry.COLUMN_NAME_CONTENT_IDENTIFIER
                            } = ? AND ${ContentMarkerEntry.COLUMN_NAME_MARKER} = ?`,
                        selectionArgs: [contentMarkerRequest.uid, contentMarkerRequest.contentId, '' + contentMarkerRequest.marker]
                    }).map(v => v!);
                }
            }
        });
    }
}
