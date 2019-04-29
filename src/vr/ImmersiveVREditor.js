import React, {Component} from 'react'
import * as THREE from 'three'

import './VREditor.css'
// for pointer (mouse, controller, touch) support
import {Pointer, POINTER_CLICK, POINTER_MOVE} from 'webxr-boilerplate/pointer'
import VRStats from "webxr-boilerplate/vrstats"
// enter and exit VR
import VRManager, {VR_DETECTED} from "webxr-boilerplate/vrmanager"
import {TREE_ITEM_PROVIDER} from '../TreeItemProvider'
import SelectionManager, {SELECTION_MANAGER} from '../SelectionManager'
import {fetchGraphObject} from '../syncgraph/utils'
import {TranslateControl} from './TranslateControl'
import panel2d from "./panel2d/panel2d";
import button2d from "./panel2d/button2d";
import group2d from "./panel2d/group2d"
import SceneDef from "./defs/SceneDef"
import {on} from "../utils"
import {TweenManager} from "../common/tween"
import {
    get3DObjectDef,
    is3DObjectType,
    OBJ_TYPES,
    SIMPLE_COLORS,
    toRad,
    TOTAL_OBJ_TYPES,
} from './Common'
//use the oculus go controller
import ThreeDOFController from "./3dof.js"
import ScriptManager from './ScriptManager'

const {SET_PROPERTY, CREATE_OBJECT, INSERT_ELEMENT, DELETE_ELEMENT} = require("syncing_protocol");


export default class ImmersiveVREditor extends Component {
    constructor(props) {
        super(props)
        this.obj_node_map = {}
        this.scriptManager = new ScriptManager({
            getAllBehaviors: () => {
                return this.props.provider.accessObject(this.props.provider.getSceneRoot())
                    .find((obj)=> obj.type === TOTAL_OBJ_TYPES.BEHAVIOR)
            },
            getParsedBehaviorAsset: (beh) => {
                const prov = this.props.provider
                const asset = prov.accessObject(beh.behavior)
                return prov.getCachedBehaviorAsset(asset.id)
            },
            getCurrentScene: () => {
                return this.props.provider.accessObject(this.currentScene)
            },
            getBehaviorsForObject: (obj) => {
                return obj.getChildren().filter(ch => ch.type === TOTAL_OBJ_TYPES.BEHAVIOR)
            },
            getSceneObjects: (scene) => {
                return scene.getChildren().filter(ch => is3DObjectType(ch.type))
            },
            findThreeObject:(id) => {
                return this.findNode(id)
            },
            navigateScene: (id) => {
                this.swapScene(id)
            }
        })
    }

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false
    }


    render() {
        return <div>
            <div id="overlay">
                <div id="inner">
                    <h1>Application Name</h1>
                    <div id="loading-indicator">
                        <label>loading</label>
                        <progress max="100" value="0" id="progress"></progress>
                    </div>
                    <button id="enter-button" disabled>VR not supported, play anyway</button>
                </div>
            </div>
            <div ref={c => this.wrapper = c}></div>
        </div>
    }


    componentDidMount() {
        this.sceneWrappers = {}
        this.initScene()
        this.renderer.setAnimationLoop(this.render3.bind(this))
    }

    render3(time) {
        //update the pointer and stats, if configured
        if(this.tweenManager) this.tweenManager.update(time)
        if(this.pointer) this.pointer.tick(time)
        if(this.stats) this.stats.update(time)
        if(this.controller) this.controller.update(time)
        if(this.scriptManager.isRunning()) this.scriptManager.tick(time)
        this.renderer.render( this.scene, this.camera );
    }

    initScene() {

        const $ = (sel) => document.querySelector(sel)
        const on = (elem, type, cb) => elem.addEventListener(type,cb)

        const container = this.wrapper
        this.tweenManager = new TweenManager()
        this.scene = new THREE.Scene();
        this.stageRot = new THREE.Group()
        this.scene.add(this.stageRot)
        this.stagePos = new THREE.Group()
        this.stageRot.add(this.stagePos)
        this.camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 50 );
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        const renderer = this.renderer
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( window.innerWidth, window.innerHeight );
        renderer.gammaOutput = true
        renderer.vr.enabled = true;
        container.appendChild( renderer.domElement );
        this.vrmanager = new VRManager(renderer)

        this.audioListener = new THREE.AudioListener()
        this.camera.add(this.audioListener)

        this.initContent()

        window.addEventListener( 'resize', ()=>{
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize( window.innerWidth, window.innerHeight );
        }, false );


        on($("#enter-button"),'click',()=>{
            $("#overlay").style.display = 'none'
            //we can start playing sound now
        })

        this.vrmanager.addEventListener(VR_DETECTED,()=>{
            console.log("VR detected")
            $("#enter-button").removeAttribute('disabled',false)
            $("#enter-button").innerText = "enter vr"
            on($("#enter-button"),'click',()=> this.vrmanager.enterVR())
        })

        const WAIT_FOR_LOAD = false

        if(!WAIT_FOR_LOAD) {
            $("#loading-indicator").style.display = 'none'
            $("#enter-button").style.display = 'block'
            $("#enter-button").removeAttribute('disabled')
        }

        this.props.provider.onRawChange(this.updateSceneOp.bind(this))
        this.props.provider.on(TREE_ITEM_PROVIDER.DOCUMENT_SWAPPED, this.documentSwapped.bind(this))
        SelectionManager.on(SELECTION_MANAGER.CHANGED, this.selectionChanged.bind(this))
        //clear selection when click on the bg
        on(this.pointer,POINTER_CLICK,()=> SelectionManager.clearSelection())

        this.controller = new ThreeDOFController(this.stagePos, this.stageRot)
        // on(this.controller,'move', this.standardProximityHandler)

        this.loadScene()
    }

    selectionChanged() {
        const sel = SelectionManager.getSelection()
        if (sel === null && this.controls) return this.controls.detach(this.selectedNode)
        const node = this.findNode(sel)
        if(this.selectedNode !== node && this.controls) this.controls.detach(this.selectedNode)
        this.selectedNode = node
        if (this.selectedNode && this.controls) this.controls.attach(this.selectedNode, this.pointer)
    }

    standardViewClickHandler = (e)  => {
        if(this.scriptManager.isRunning()) {
            this.scriptManager.performClickAction(this.props.provider.accessObject(e.target.userData.graphid))
        } else {
            SelectionManager.setSelection(e.target.userData.graphid)
        }
    }


    initContent() {
        this.scene.background = new THREE.Color( 0xcccccc );
        const light = new THREE.DirectionalLight( 0xffffff, 1.0 );
        light.position.set( 1, 1, 1 ).normalize();
        this.scene.add( light );
        this.scene.add(new THREE.AmbientLight(0xffffff,0.2))

        // enable stats visible inside VR
        this.stats = new VRStats(this.renderer)
        if(this.props.editable) {
            this.camera.add(this.stats)
        }
        this.scene.add(this.camera)

        //class which handles mouse and VR controller
        this.pointer = new Pointer(this.scene,this.renderer,this.camera, {
            intersectionFilter: ((o) => o.userData.clickable),
            cameraFollowMouse:false,
            mouseSimulatesController:false,
            enableLaser: true,
            laserLength: 20,
        })


        const STICK_HEIGHT = 1.0
        const stick = new THREE.Mesh(
            new THREE.CylinderBufferGeometry(0.1,0.1,STICK_HEIGHT),
            new THREE.MeshLambertMaterial({color:'aqua'})
        )
        stick.position.z = -STICK_HEIGHT/2;
        stick.rotation.x = toRad(-90)
        this.pointer.controller1.add(stick)


        if(this.props.editable) {
            this.controls = new TranslateControl()
            this.controls.name = 'Controls'
            on(this.controls, 'change', (e) => {
                const sel = SelectionManager.getSelection()
                if (sel) {
                    const node = this.findNode(sel)
                    const prov = this.props.provider
                    prov.quick_setPropertyValue(sel, 'tx', node.position.x)
                    prov.quick_setPropertyValue(sel, 'ty', node.position.y)
                    prov.quick_setPropertyValue(sel, 'tz', node.position.z)
                }
            })
        }

        if(this.props.editable) {
            this.tools = new panel2d(this.scene, this.camera)
            this.tools.position.set(-1, 1, -3)
            this.scene.add(this.tools)


            this.tools.add(new button2d()
                .setAll({x: 5, y: 5, text: 'add box'})
                .on(POINTER_CLICK, () => this.props.provider.add3DObject(OBJ_TYPES.cube)))
            this.tools.add(new button2d()
                .setAll({x: 5, y: 5 + 30, text: 'add sphere'})
                .on(POINTER_CLICK, () => this.props.provider.add3DObject(OBJ_TYPES.sphere)))
            this.tools.add(new button2d()
                .setAll({x: 5, y: 5 + 30 + 30, text: 'delete'})
                .on(POINTER_CLICK, this.props.provider.deleteObject))
            this.tools.add(new button2d()
                .setAll({x: 5, y: 5 + 30 + 30 + 30, text: 'save'})
                .on(POINTER_CLICK, this.props.provider.save))
            const runButton = new button2d()
                .setAll({x:5, y: 5+30*4, text:'run'})
                .on(POINTER_CLICK,() => {
                    if(this.scriptManager.isRunning()) {
                        runButton.set('text','run')
                        this.scriptManager.stopRunning()
                    } else {
                        runButton.set('text','stop')
                        this.scriptManager.startRunning()
                    }
                })
            this.tools.add(runButton)

            const rowLayout = (panel) => {
                let x = 0
                panel.comps.forEach((c) => {
                    c.x = x
                    c.y = 0
                    x += c.w + panel.padding
                })
            }

            const color_group = new group2d().setAll({x: 5, y: 5 + 30 * 5, w: 235, h: 35, layout: rowLayout})
            SIMPLE_COLORS.forEach(c => {
                color_group.add(new button2d()
                    .setAll({text: ' ', normalBg: c})
                    .on(POINTER_CLICK, () => this.props.provider.setColor(c))
                )
            })

            this.tools.add(color_group)

            this.tools.redraw()
        }

    }


    updateSceneOp(op) {
        const graph = this.props.provider.getDataGraph()
        //only do scenes with create_object
        if (op.type === CREATE_OBJECT) {
            if(op.defaults) {
                //console.log("creating object with defaults",op.defaults)
                if(op.defaults.type === 'scene') {
                    let node =  this.findNode(op.id)
                    if(node) {
                        // console.log("scene already exists. skipping", node.name)
                    } else {
                        // console.log("Making a real scene", op)
                        const obj = fetchGraphObject(graph, op.id)
                        node = new SceneDef().makeNode(obj)
                        this.insertNodeMapping(op.id,node)
                        this.sceneWrappers[op.id] = node
                        this.stagePos.add(node)
                        // this.scene.add(node)
                        this.swapScene(op.id)
                    }
                }
            }
        }
        // other objects are done with insert_element
        if (op.type === INSERT_ELEMENT) {
            const objid = op.value
            const obj = fetchGraphObject(graph, objid)
            if (obj.type === 'scene') return // console.log("skipping insert scene")
            if(is3DObjectType(obj.type)) {
                const nodeObj = get3DObjectDef(obj.type).makeNode(obj)
                on(nodeObj, POINTER_CLICK, this.standardViewClickHandler)
                this.insertNodeMapping(objid, nodeObj)
                this.sceneWrappers[obj.parent].add(nodeObj)
                return
            }
            if(obj.type === 'assets') return
            if(obj.type === 'asset') return
            console.warn("unknown object type", obj)
            return
        }
        if (op.type === SET_PROPERTY) {
            const obj = fetchGraphObject(graph, op.object)
            if(obj.type === 'asset') return
            if(obj.type === 'assets') return
            const node = this.findNode(op.object)
            if (node) {
                if(op.name === 'parent') return
                if(obj.type === 'scene') return new SceneDef().updateProperty(node,obj,op,this.props.provider)
                if(is3DObjectType(obj.type)) return get3DObjectDef(obj.type).updateProperty(node,obj,op, this.props.provider)
            } else {
                console.log("could not find the node for object id:", op)
                console.log("objects are",this.obj_node_map)
            }
            return
        }
        if(op.type === DELETE_ELEMENT) {
            const obj = fetchGraphObject(graph,op.value)
            if(is3DObjectType(obj.type)) {
                const node = this.findNode(op.value)
                this.sceneWrappers[obj.parent].remove(node)
            }
            return
        }
        // console.log('skipping', op.type)
    }
    documentSwapped() {
        console.log("totally new document!")
        //nuke all the old stuff
        Object.keys(this.sceneWrappers).forEach(key => {
            const scene = this.sceneWrappers[key]
            if(this.controls) scene.remove(this.controls)
            this.stagePos.remove(scene)
        })
        this.sceneWrappers = {}
        this.obj_node_map = {}
        // this.setState({scene: -1})
        //make new stuff
        const hist = this.props.provider.getDocHistory()
        hist.forEach(op => this.updateSceneOp(op))
    }

    swapScene(id) {
        this.currentScene = id
        console.log("swapping to the scene",id)
        //make all scenes invisible except the right one
        Object.keys(this.sceneWrappers).forEach(key => {
            const scene = this.sceneWrappers[key]
            scene.visible = (key === id)
            if(this.controls) scene.remove(this.controls)
        })
        if(this.controls) this.sceneWrappers[id].add(this.controls)
        this.sceneWrappers[id].position.x = 0
        this.sceneWrappers[id].position.z = 0
    }


    loadScene() {
    }

    insertNodeMapping(id, node) {
        if (typeof id !== 'string') throw new Error("cannot map an object to an object. invalid call in insertNodeMapping")
        this.obj_node_map[id] = node
        node.userData.graphid = id
    }

    findNode(id) {
        if (!this.obj_node_map[id]) console.warn("could not find node for id", id)
        return this.obj_node_map[id]
    }

    playAudioAsset(audio, target) {
        console.log("playing the audio",audio,'on the target',target)
        const sound = new THREE.Audio(this.audioListener)
        const audioLoader = new THREE.AudioLoader()
        audioLoader.load(audio.src, function( buffer ) {
            sound.setBuffer( buffer );
            sound.setLoop( true );
            sound.setVolume( 0.5 );
            sound.play();
        });
    }

}


