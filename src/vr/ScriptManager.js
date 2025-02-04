import {OBJ_TYPES, TOTAL_OBJ_TYPES} from './Common'
import * as THREE from "three"
import WebLayer3D from 'three-web-layer'
import GPUParticles from './defs/GPUParticles'
import GLTFLoader from './GLTFLoader'

export class SceneGraphProvider {
    //return the current scene. provider is in charge of tracking which scene is considered 'current'
    //including the default scene when the project loads
    getCurrentScene() { throw new Error("getCurrentScene not implemented")}
    getSceneObjects(scene) { throw new Error("getSceneObjects not implemented")}
    getBehaviorsForObject(obj) { throw new Error("getBehaviorsForObject(obj) not implemented")}
    //return threejs object for the id of the graph object
    getThreeObject(id) { throw new Error("getThreeObject(id) not implemented")}
    getParsedBehaviorAsset(beh) { throw new Error("getParsedBehaviorAsset(behavior) not implemented")}
    getAllBehaviors() { throw new Error("getAllBehaviors() not implemented")}
    getAllScenes() { throw new Error("getAllScenes not implemented")}

    //navigate to the specified scene. id is a graph object id
    navigateScene(id) { throw new Error("navigateScene(id) not implemented")}

    playMediaAsset(id) { throw new Error("playMediaAsset(id) not implemented")}
    stopMediaAsset(id) { throw new Error("stopMediaAsset(id) not implemented")}
    getGraphObjectByName(name) { throw new Error("getGraphObjectByName(name) not implemented")}
    getGraphObjectById(id) { throw new Error("getGraphObjectById(id) not implemented")}
    getCamera() { throw new Error("getCamera() not implemented")}
    getTweenManager() { throw new Error("getTweenManager() not implemented")}
    getFloorNear(info) { throw new Error("getFloorNear not implemented")}
    startLocalAnchor(info) { throw new Error("startLocalAnchor not implemented")}
    stopLocalAnchor(info) { throw new Error("stopLocalAnchor not implemented")}
    startImageRecognizer(info) { throw new Error("startImageRecognizer not implemented")}
    stopImageRecognizer(info) { throw new Error("stopImageRecognizer not implemented")}
    startGeoTracker(info) { throw new Error("startGeoTracker not implemented")}
    stopGeoTracker(info) { throw new Error("stopGeoTracker not implemented")}
    startWorldInfo(info) { throw new Error("startWorldInformation not implemented")}
    stopWorldInfo(info) { throw new Error("stopWorldInformation not implemented")}

}

class SystemFacade {

    constructor(manager, sgp, behavior) {
        this.manager = manager
        this.sgp = sgp
        this.logger = this.manager.logger
        this.tween = sgp.getTweenManager()
        this.camera = sgp.getCamera()
        this.globalStorage = this.manager.storage
        this.behavior = behavior
    }

    get globals () {
        return {
            THREE:THREE,
            GLTFLoader: GLTFLoader,
            GPUParticles: GPUParticles,
            WebLayer3D: WebLayer3D
        }
    }

    get properties () {
        return this.behavior.props()
    }
    getThreeObjectByTitle(title) {
        const obj = this.sgp.getGraphObjectByName(title)
        if(!obj) throw new Error(`three object '${title}' not found`)
        return this.sgp.getThreeObject(obj)
    }
    getObjectByTitle(title) {
        const obj = this.sgp.getGraphObjectByName(title)
        if(!obj || !obj.exists()) throw new Error(`object '${title}' not found`)
        return obj
    }
    getAssetByTitle(title) {
        const obj = this.sgp.getGraphObjectByName(title)
        if(!obj || !obj.exists()) throw new Error(`asset '${title}' not found`)
        let trusted = this._event && this._event.data && this._event.data.event && this._event.data.event.isTrusted
        return new AssetFacade(this.manager,obj, trusted)
    }
    getAssetById(id) {
        const obj = this.getObjectById(id)
        if(!obj || !obj.exists()) throw new Error(`asset '${id}' not found`)
        let trusted = this._event && this._event.data && this._event.data.event && this._event.data.event.isTrusted
        return new AssetFacade(this.manager,obj,trusted)
    }
    getObjectById(id) {
        const obj = this.sgp.getGraphObjectById(id)
        if(!obj || !obj.exists()) throw new Error(`object '${id}' not found`)
        return obj
    }
    getThreeObjectById(id) {
        return this.sgp.getThreeObject(id)
    }
    playSound(id) {
        this.playMedia(id)
    }

    playMedia(id) {
        const asset = this.sgp.getGraphObjectById(id)
        if(!asset || !asset.exists()) throw new Error(`asset '${id}' not found`)
        let trusted = this._event && this._event.data && this._event.data.event && this._event.data.event.isTrusted
        this.manager.sgp.playMediaAsset(asset, trusted)
    }

    stopMedia(id) {
        const asset = this.sgp.getGraphObjectById(id)
        if(!asset || !asset.exists()) throw new Error(`asset '${id}' not found`)
        this.manager.sgp.stopMediaAsset(asset)
    }

    getCurrentScene() {
        const obj = this.sgp.getCurrentScene()
        if(!obj || !obj.exists()) throw new Error(`current scene not found`)
        return obj
    }
    navigateScene(id) {
        this.manager.fireSceneLifecycleEvent('exit',this.getCurrentScene())
        this.sgp.navigateScene(id)
        this.manager.fireSceneLifecycleEvent('enter',this.getCurrentScene())
    }
    fireEvent(type,payload,target=null) {
        // this.manager.fireEventFromTarget(target,type,payload)
        if (target == null) {
            target = this.sgp.getGraphObjectById(this.behavior.parent)
        }
        this.manager.fireEventAtTarget(target,type,payload)
    }
    sendMessage(name,payload,target=null) {
        if (target == null) {
            target = this.sgp.getGraphObjectById(this.behavior.parent)
        }
        this.manager.fireMessageAtTarget(target,name,payload)
    }
    captureEvent() {
        this.manager.captureEvent()
    }
}

export default class ScriptManager {
    constructor(sceneGraphProvider, logger) {
        this.sgp = sceneGraphProvider
        this.logger = logger
        this.running = false
        this.storage = {}
        this.logger = logger
        this.logger.log("ScriptManager created")
        this.system_cache = {}

        this.bubbling = true;

        if (!window.THREE) window.THREE = THREE
        if (!window.GLTFLoader) window.GLTFLoader = GLTFLoader
        if (!window.GPUParticles) window.GPUParticles = GPUParticles
        if (!window.WebLayer3D) window.WebLayer3D = WebLayer3D
    }


    fireLifecycleEvent(type) {
        this.logger.log(`doing ${type} event`)
        const evt = {
            type:type
        }
        this.sgp.getAllScenes().forEach(scene => {
            scene.find(child => {
                if(child.type === TOTAL_OBJ_TYPES.BEHAVIOR) {
                    evt.target = this.sgp.getThreeObject(child.parent)
                    evt.graphTarget = this.sgp.getGraphObjectById(child.parent)
                    const asset = this.sgp.getParsedBehaviorAsset(child)
                    const system = this.getSystemFacadeFromCache(child)
                    system.code = asset
                    if (asset[type]) asset[type].call(system,evt)
                } else {
                    evt.target = this.sgp.getThreeObject(child)
                    evt.graphTarget = child
                    if(evt.target && evt.target[type]) evt.target[type](evt, this)
                }
            })
        })
    }

    fireSceneLifecycleEvent(type, scene, time) {
        if(type!=='tick') this.logger.log(`doing ${type} event`)

        const evt = {
            type: type,
            time: time ? time - this.startTime : -1,
            deltaTime: time ? time - this.lastTime : 0,
            session: this.session
        }
        if (time) {
            this.lastTime = time
        }
        scene.find(child => {
            const parentId = child.parent
            this.fireSceneLifecycleEventAtChild(type,evt,child,parentId)
        })
    }

    fireSceneLifecycleEventAtChild(type,evt,child, parentId) {
        if(type!=='tick') this.logger.log(`calling ${type} on ${child.type} ${child.id}`)
        if(child.type === TOTAL_OBJ_TYPES.BEHAVIOR) {
            evt.target = this.sgp.getThreeObject(parentId)
            evt.graphTarget = this.sgp.getGraphObjectById(parentId)
            //evt.props = child.props()
            const asset = this.sgp.getParsedBehaviorAsset(child)
            const system = this.getSystemFacadeFromCache(child)
            system.code = asset
            if (asset[type]) asset[type].call(system,evt)
            // if(asset[type]) asset[type](evt)
        } else {
            evt.target = this.sgp.getThreeObject(child)
            evt.graphTarget = child
            if(evt.target && evt.target[type]) evt.target[type](evt, this)
            if(child.type === OBJ_TYPES.clone) {
                if (type !== 'tick') console.log(`also doing ${type} event on a clone`)
            }
        }
    }

    tick(time, session) {
        if(!this.running) return
        if(this.startTime ===0) {
            this.startTime = time
            this.lastTime = time
        }
        try {
            this.session = session
            this.fireSceneLifecycleEvent('tick',this.sgp.getCurrentScene(),time)
        } catch (err) {
            this.logger.error("error in script",err.message)
            this.logger.log(err)
            this.stopRunning()
        }
    }


    startRunning() {
        this.running = true
        this.startTime = 0
        this.lastTime = 0
        this.storage = {}
        this.logger.log("ScriptManager starting")
        try {
            this.fireLifecycleEvent('start')
        } catch(err) {
            this.logger.error("error in script",err.message)
            this.logger.error(err)
            this.stopRunning()
        }
    }

    startFirstScene() {
        try {
            this.fireSceneLifecycleEvent('enter',this.sgp.getCurrentScene())
        } catch(err) {
            this.logger.error("error in script",err.message)
            this.logger.error(err)
            this.stopRunning()
        }
    }
    

    stopRunning() {
        try {
            this.fireSceneLifecycleEvent('exit',this.sgp.getCurrentScene())
            this.fireLifecycleEvent('stop')
            this.running = false
            this.storage = {}
            this.destroyListeners()
        } catch(err) {
            this.running = false
            this.logger.error("error stopping scripts",err.message)
            this.logger.error(err)
        }
        this.logger.log("script manager stopping")
    }
    isRunning() {
        return this.running
    }

    fireMessageAtTarget(target, name, payload) {
        if(!this.running) return
        try { 
            const evt = {
                type: 'message',
                name: name,
                data: payload,
                time: this.lastTime,
                target: this.sgp.getThreeObject(target),
                graphTarget: target,
            }
            const behaviors = this.sgp.getBehaviorsForObject(target)
            behaviors.forEach(b => {
                const system = this.getSystemFacadeFromCache(b)
                const asset = this.sgp.getParsedBehaviorAsset(b)
                system._event = evt   // want to be able to look for this later
                system.code = asset
                if (asset.message) asset.message.call(system,evt)
                system._event = null
            })
        } catch (error) {
            this.logger.error("error in '" + name + "' message",error.message)
            this.logger.error(error)
            this.stopRunning()
        }
    }

    performClickAction(target, e) {
        this.fireEventAtTarget(target, "click", {event: e})
    }

    captureEvent() {
        this.bubbling = false
    }

    fireEventAtTarget(target, type, payload) {
        if(!this.running) return
        try { 
            this.bubbling = true

            const evt = {
                type: type,
                data: payload,
                time: this.lastTime,
                target: this.sgp.getThreeObject(target),
                graphTarget: target,
            }

            let scene = this.sgp.getCurrentScene()
            while (this.bubbling && target.id !== scene.id && target.type !== TOTAL_OBJ_TYPES.SCENE) {
                //console.log("getting behaviors for the object",target)
                const behaviors = this.sgp.getBehaviorsForObject(target)
                //this.logger.log("firing " + type + " at target " + target.id + ", " + behaviors.length + " behaviors")

                behaviors.forEach(b => {
                    const system = this.getSystemFacadeFromCache(b)
                    const asset = this.sgp.getParsedBehaviorAsset(b)
                    system._event = evt
                    if (asset[type]) {
                        system.code = asset
                        // this.logger.log("found message on behavior")
                        asset[type].call(system,evt)
                    } else {
                        // this.logger.log("didn't find message on behavior")
                    }
                    system._event = null
                })
                target = this.sgp.getGraphObjectById(target.parent)
            }
        } catch (error) {
            this.logger.error("error in '" + type + "' event",error.message)
            this.logger.error(error)
            this.stopRunning()
        }
    }

    destroyListeners() {
        this.listeners = {}
    }

    on(target,type,cb) {
        if(!this.listeners) this.listeners = {}
        if(!this.listeners[target.id]) this.listeners[target.id] = {}
        if(!this.listeners[target.id][type]) this.listeners[target.id][type] = []
        this.listeners[target.id][type].push(cb)
    }

    getSystemFacadeFromCache(behavior) {
        if(!this.system_cache[behavior.id]) {
            this.system_cache[behavior.id] = new SystemFacade(this, this.sgp, behavior)
        }
        return this.system_cache[behavior.id]
    }
}


class AssetFacade {
    constructor(manager,obj, trusted) {
        this.manager = manager
        this.obj = obj
        this.trusted = trusted
    }
    play() {
        this.manager.sgp.playMediaAsset(this.obj, this.trusted)
    }
    stop() {
        this.manager.sgp.stopMediaAsset(this.obj)
    }
}
