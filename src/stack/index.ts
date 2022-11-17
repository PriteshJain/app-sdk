import Asset from './api/asset/index';
import ContentType from './api/content-type/index';
import { onData, onError } from "../utils";
import { BranchDetail, StackAdditionalData, StackDetail } from '../types/stack.types';


/**
 * Class representing the current stack in Contentstack UI.
 */

class Stack {
  /**
   * @hideconstructor
   */

  _connection: any
  _data: StackDetail
  ContentType: any // TODO: change it
  Asset: any // TODO: change it
  private _currentBranch: BranchDetail | null = null;


  constructor(data: StackDetail = {} as StackDetail, connection: any, additionalData: StackAdditionalData) {
    this._connection = connection;
    this._data = data;
    /**
     * @constructor
     * @hideconstructor
     * @desc Content type defines the structure or schema of a page or a section of your web or mobile property
     * @see {@link https://www.contentstack.com/docs/apis/content-management-api/#content-types| ContentType}
     * @param {string} uid - Uid of contenttype.
     * @example extension.stack.ContentType('content_type_uid')
     * */
    this.ContentType = ContentType(connection);
    /**
     * @constructor
     * @hideconstructor
     * @desc An initializer is responsible for creating an Asset object.
     * @see {@link https://www.contentstack.com/docs/apis/content-management-api/#assets| Asset}
     * @param {string} uid - UID of the asset.
     * @example extension.stack.Asset('asset_uid')
     * */
    this.Asset = Asset(connection);

    const currentBranch = additionalData.currentBranch || ""

    if (currentBranch) {
      this._currentBranch =
        (data.branches || []).find(
            (branch) => branch.uid === additionalData.currentBranch
        ) || null;
    }

  }


  /**
   * This method returns the data of the current stack.
   * @return {Object} Returns stack data.
   */

  getData() {
    return this._data;
  }


  /**
   * This method returns all the stacks in the current organization.
   * @returns Stacks within current organization
   */
  getAllStacks(): Promise<StackDetail[]> {
    const options = { action: "getAllStacks", org_uid: this._data.org_uid };
    return this._connection
      .sendToParent("stackQuery", options)
      .then(onData)
      .then((data) => data.stacks || [])
      .catch(onError);

  }


  /**
   * This API allows you to retrieve data of a content type of a stack using the {@link https://www.contentstack.com/docs/apis/content-management-api/#get-a-single-content-type| Content Type API} requests. This method returns a Promise object.
   * @param {string} uid Uid of the desired content type
   * @param {Object} params Optional parameters for the GET call
   * @return {Object} A promise object which will be resolved with content type details.
   */
  getContentType(uid: string, params = {}): Promise<{ [key: string]: any }> {
    if (!uid) {
      return Promise.reject(new Error('uid is required'));
    }
    const options = { uid, params, action: 'getContentType' };
    return this._connection.sendToParent('stackQuery', options).then(onData).catch(onError);
  }

  /**
   * This API allows you to retrieve data of a content types of a stack using the {@link https://www.contentstack.com/docs/apis/content-management-api/#get-all-content-types| Content Types API} requests. This method returns a Promise object.
   * @param {Object} query Query for the GET call
   * @param {Object} params Optional parameters for the GET call
   * @return {Object} A promise object which will be resolved with details of the content type.
   */
  getContentTypes(query = {}, params: { [key: string]: any } = {}): Promise<{ [key: string]: any }> {
    const optionParams = params;
    optionParams.query = query;
    const options = { params: optionParams, action: 'getContentTypes' };
    return this._connection.sendToParent('stackQuery', options).then(onData).catch(onError);
  }

  /**
   * This API allows you to retrieve environment details of a stack using the {@link https://www.contentstack.com/docs/apis/content-management-api/#get-a-single-environment| Environment API} requests. This method returns a Promise object.
   * @param {string} name Name of the desired environment
   * @param {Object} params Optional parameters for the GET call
   * @return {Object} A promise object which will be resolved with environment details.
   */
  getEnvironment(name: string, params = {}) {
    if (!name) {
      return Promise.reject(new Error('name is required'));
    }
    const options = { name, params, action: 'getEnvironment' };
    return this._connection.sendToParent('stackQuery', options).then(onData).catch(onError);
  }

  /**
   * This API allows you to retrieve details of environments of a stack using the {@link https://www.contentstack.com/docs/apis/content-management-api/#get-all-environments| Environments API} requests. This method returns a Promise object.
   * @param {Object} query Query for the GET call
   * @param {Object} params Optional parameters for the GET call
   * @return {Object} A Promise object which will be resolved with details of the environments.
   */
  getEnvironments(query = {}, params = {}) {
    const optionParams: { [key: string]: any } = params;
    optionParams.query = query;
    const options = { params: optionParams, action: 'getEnvironments' };
    return this._connection.sendToParent('stackQuery', options).then(onData).catch(onError);
  }

  /**
   * This API allows you to retrive a locale of a stack using the {@link https://www.contentstack.com/docs/apis/content-management-api/#get-a-language| Language API} requests. Method returns a Promise object.
   * @param {string} code Code of the desired locale
   * @param {Object} params Optional parameters for the GET call
   * @return {Object} A promise object which will be resolved with locale details.
   */
  getLocale(code: string, params = {}) {
    if (!code) {
      return Promise.reject(new Error('code is required'));
    }
    const options = { code, params, action: 'getLocale' };
    return this._connection.sendToParent('stackQuery', options).then(onData).catch(onError);
  }

  /**
   * This API allows you to retrive the locales of a stack using the {@link https://www.contentstack.com/docs/apis/content-management-api/#get-all-content-types| Languages API} requests. Method returns a Promise object.
   * @param {Object} query Query for the GET call
   * @param {Object} params Optional parameters for the GET call
   * @return {Object} A Promise object which will be resolved with details of the locales.
   */
  getLocales(query = {}, params = {}) {
    const optionParams: { [key: string]: any } = params;
    optionParams.query = query;
    const options = { params: optionParams, action: 'getLocales' };
    return this._connection.sendToParent('stackQuery', options).then(onData).catch(onError);
  }

  /**
   * This API allows you to retrive a workflow of a stack using the {@link https://www.contentstack.com/docs/apis/content-management-api/#get-a-workflow| Language API} requests. Method returns a Promise object.
   * @param {string} code Code of the desired locale
   * @param {Object} params Optional parameters for the GET call
   * @return {Object} A promise object which will be resolved with locale details.
   */
    getWorkflow(uid: string, params = {}) {
      if (!uid) {
        return Promise.reject(new Error('workflow uid is required'));
      }
      const options = { uid, params, action: 'getWorkflow' };
      return this._connection.sendToParent('stackQuery', options).then(onData).catch(onError);
    }
  
    /**
     * This API allows you to retrive the locales of a stack using the {@link https://www.contentstack.com/docs/apis/content-management-api/#get-all-content-types| Languages API} requests. Method returns a Promise object.
     * @param {Object} query Query for the GET call
     * @param {Object} params Optional parameters for the GET call
     * @return {Object} A Promise object which will be resolved with details of the locales.
     */
    getWorkflows(query = {}, params = {}) {
      const optionParams: { [key: string]: any } = params;
      optionParams.query = query;
      const options = { params: optionParams, action: 'getWorkflows' };
      return this._connection.sendToParent('stackQuery', options).then(onData).catch(onError);
    }

    /**
     * This API allows you to retrieve all the branches in the current stack
     * @returns All branches of the current stack
     */
    getAllBranches(): BranchDetail[] {
      return this._data.branches || [];
    }

    /**
     * Returns the details of the current branch of the stack if available
     * @returns current branch of the current stack if available
     */
    getCurrentBranch(): BranchDetail | null {
      return this._currentBranch;
    }
}

export default Stack;
