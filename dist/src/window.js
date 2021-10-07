"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var config = { attributes: true, childList: true, subtree: true };
var observer;
/**
 * Class representing an iframe window from Contentstack UI. Not available for Custom Widgets.
 */
var Window = /** @class */ (function () {
    function Window(connection, type, emitter, state) {
        if (state === void 0) { state = 'half_width'; }
        this._connection = connection;
        this._autoResizingEnabled = false;
        this._resizingEnabled = false;
        this.type = type;
        this.state = state;
        this._emitter = emitter;
    }
    /**
     * This method activates the resize button that gives you the provision to resize the window size of your Dashboard Widget.
     * @return {external:Promise}  A promise object which will resolve when a resize button is visible on the Dashboard Widget.
     */
    Window.prototype.enableResizing = function () {
        if (this.type !== 'DASHBOARD') {
            return Promise.resolve();
        }
        this._resizingEnabled = true;
        return this._connection.sendToParent('window', { action: 'enableResizing' });
    };
    /**
     * This function executes the callback function whenever a Dashboard Widget extension is maximized or minimized. Only applicable on Dashboard Widget extensions.
     * @param {function} callback Function to be called when a Dashboard Widget extension is maximized or minimized
     * @return {boolean} Will return true
     */
    Window.prototype.onDashboardResize = function (callback) {
        var windowObj = this;
        if (this.type !== 'DASHBOARD') {
            return false;
        }
        if (callback && typeof (callback) === 'function') {
            windowObj._emitter.on('dashboardResize', function (event) {
                windowObj.state = event.state;
                callback(event.state);
            });
        }
        else {
            throw Error('Callback must be a function');
        }
        return true;
    };
    /**
     * This method updates the extension height on Contentstack UI.
     * If the ‘height’ argument is not passed, it will calculate the scroll height and set the height of extension window accordingly.
     * @param {string|number} height Desired height of the iframe window
     * @return {external:Promise}  A promise object which will be resolved when Contentstack UI sends an acknowledgement stating that the height has been updated.
     */
    Window.prototype.updateHeight = function (height) {
        if (this.type === 'DASHBOARD' && this.state === 'half_width') {
            return Promise.resolve();
        }
        if (!height || isNaN(height)) {
            this._height = Math.ceil(document.documentElement.getBoundingClientRect().height);
        }
        else if (this._height === height) {
            return Promise.resolve();
        }
        else {
            this._height = height;
        }
        return this._connection.sendToParent('resize', this._height);
    };
    /**
     * This method enables auto resizing of the extension height.
     * @return {Window}.
     */
    Window.prototype.enableAutoResizing = function () {
        if (this._autoResizingEnabled || (this.state === 'half_width' && this.type === 'DASHBOARD')) {
            return this;
        }
        this._autoResizingEnabled = true;
        //@ts-ignore
        observer = new MutationObserver(this.updateHeight.bind(this));
        observer.observe(window.document.body, config);
        return this;
    };
    /**
     * This method disables auto resizing of the extension height.
     * @return {Window}.
     */
    Window.prototype.disableAutoResizing = function () {
        if (!this._autoResizingEnabled) {
            return this;
        }
        this._autoResizingEnabled = false;
        observer.disconnect();
        return this;
    };
    return Window;
}());
exports.default = Window;
//# sourceMappingURL=window.js.map