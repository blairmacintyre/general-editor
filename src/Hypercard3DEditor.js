import React, { Component } from 'react';
import TreeItemProvider, {TREE_ITEM_PROVIDER} from "./TreeItemProvider";
import * as THREE from "three";
import Selection, {SELECTION_MANAGER} from './SelectionManager'
import QRCode from "qrcode"

const data = {
    root: {
        title:'stack',
        type:'stack',
        children: [
            {
                type:'scene',
                id:'scene1',
                title:'Opening Scene',
                children:[
                    {
                        id:'cube1',
                        type:'cube',
                        title:'first cube',
                        x:0,
                        y:0,
                        z:0,
                        rx:0,
                        ry:0,
                        rz:0,
                        size:1,
                        color:'#ffffff',
                    },
                ]
            },
        ]
    }
}

class ThreeDeeViewer extends Component {
    constructor(props) {
        super(props)
    }
    componentDidMount() {
        let w = 500
        let h = 500
        if(this.props.fillScreen === true) {
            //TODO: figure out why I need this fudge. anything less and it scrolls
            w = window.innerWidth-4
            h = window.innerHeight-4
        }
        this.scene = new THREE.Scene()
        this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({canvas: this.canvas});
        this.renderer.setSize(w,h);
        this.camera.position.z = 5;
        this.rebuildScene(this.props.scene)
        this.redraw();
    }
    componentWillReceiveProps(newProps) {
        console.log("getting props for the scene",newProps)
        this.rebuildScene(newProps.scene)
        this.redraw()
    }
    rebuildScene(scene) {
        if(!this.scene) return
        if(!this.scene.children) return
        while (this.scene.children.length) this.scene.remove(this.scene.children[0]);
        this.animatable = []
        if(scene) scene.children.forEach((node)=>{
            if(node.type === 'cube') {
                const geometry = new THREE.BoxGeometry(node.size, node.size, node.size)
                // var material = new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe:true } );
                const color = parseInt(node.color.substring(1),16)
                const material = new THREE.MeshLambertMaterial({color: color})
                const cube = new THREE.Mesh(geometry, material)
                cube.position.x = node.x
                cube.position.y = node.y
                cube.position.z = node.z
                cube.rotation.x = node.rx
                cube.rotation.y = node.ry
                cube.rotation.z = node.rz
                this.scene.add( cube );
                this.animatable.push(cube)
            }
        })

        const ambient = new THREE.AmbientLight(0xffffff,0.5)
        this.scene.add(ambient)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
        directionalLight.position.x = -10
        this.scene.add( directionalLight );
    }
    redraw() {
        this.renderer.render( this.scene, this.camera );
    }
    render() {
        let w = 500
        let h = 500
        if(this.props.fillScreen === true) {
            w = "99%"
            h = "99%"
        }
        return <canvas width={w} height={h} ref={(canvas)=>this.canvas = canvas}/>
    }
}

class HypercardCanvas3D extends Component {
    constructor(props) {
        super(props)
        this.animatable = []
        this.state = {
            selection:null,
            scene:null,
            animate: false
        }
    }
    componentDidMount() {
        this.listener = Selection.on(SELECTION_MANAGER.CHANGED, (sel)=> {
            let scene = Selection.getSelection()
            if(!scene) return
            if(scene === this.props.provider.getSceneRoot()) return
            if(scene.type !== 'scene') scene = this.props.provider.findParent(this.props.provider.getSceneRoot(),scene)
            this.setState({selection:sel, animate:false, scene:scene})
        })
    }
    animate = () => {
        if(this.state.animate) requestAnimationFrame( this.animate );
        if(!this.state.scene) return
        this.animatable.forEach((ch)=> ch.rotation.y += 0.01)
        this.redraw()
    }
    render() {
        if(this.state.animate) this.animate()
        return <ThreeDeeViewer scene={this.state.scene}/>
    }
}

export const SceneItemRenderer = (props) => {
    const type = props.item.type;
    if(type === 'cube')   return <div><i className="fa fa-square"/> {props.item.title}</div>
    if(type === 'stack')  return <div><i className="fa fa-table"/> {props.item.title}</div>
    if(type === 'scene')  return <div><i className="fa fa-vcard"/> {props.item.title}</div>
    return <div>unknown item type = {type}</div>
}


export default class HypercardEditor extends TreeItemProvider {
    constructor() {
        super()
        this.root = data.root;
    }
    getTitle() {
        return 'Hypercard 3D'
    }
    getSceneRoot() {
        return this.root
    }
    getCanvas() {
        return <HypercardCanvas3D provider={this}/>
    }
    getChildren(item) {
        if(item.children) item.children.forEach((ch)=> ch.parent = item)
        return item.children;
    }
    hasChildren(item) {
        return (item.children && item.children.length>0)
    }
    findParent(root,target) {
        if(root === target) return root
        if(root.children) {
            for(let i=0; i<root.children.length; i++) {
                const ch = root.children[i]
                if(ch === target) return root;
                const res = this.findParent(ch,target)
                if(res) return res
            }
        }
        return null;
    }
    getRendererForItem(item) {
        return <SceneItemRenderer item={item}/>
    }
    getProperties(item) {
        let defs = []
        if(!item) return defs;
        Object.keys(item).forEach((key)=>{
            if(key === 'children') return;
            if(key === 'parent') return;
            let type = 'string'
            let locked = false
            if(key === 'visible') type = 'boolean'
            if(key === 'type') locked = true
            if(key === 'id') locked = true
            if(key === 'x') type = 'number'
            if(key === 'y') type = 'number'
            if(key === 'z') type = 'number'
            if(key === 'size') type = 'number'
            if(key === 'color') type = 'color'
            if(key === 'stroke') type = 'color'
            if(key === 'strokeWidth') type = 'number'
            if(key === 'target') type = 'enum'
            defs.push({
                name:key,
                key:key,
                value:item[key],
                type:type,
                locked:locked,
            })
        })
        return defs;
    }

    setPropertyValue(item,def,value) {
        if(def.type === 'number') value = parseFloat(value);
        item[def.key] = value;
        this.fire(TREE_ITEM_PROVIDER.PROPERTY_CHANGED,item)
    }

}

export class Preview3D extends Component {
    constructor(props) {
        super(props)
        this.state = {
            doc:null,
            valid:false,
            current:null
        }
    }
    componentDidMount() {
        if(window.opener && window.opener.preview_document) {
            const doc = window.opener.preview_document
            this.setState({doc:doc, current:doc.children[0], valid:true})
        }
    }
    navTo = (target) => {
        console.log("navigating")
        // const card = this.state.doc.children.find((card) => card.id === target)
        // this.setState({current:card})
    }
    render() {
        if(!this.state.valid) return <div>invalid preview. please close and try again</div>
        return <div style={{ margin:0, padding:0, borderWidth: 0}}>
            <ThreeDeeViewer scene={this.state.current} live={true} navTo={this.navTo} fillScreen={true} />
            <QRCanvas url={"http://192.168.7.25:3000/?mode=preview&provider=hypercard3D"}
                      width={300} height={300}
                      style={{position:'absolute', right:10, bottom:10}}
            />
        </div>
    }
}

class QRCanvas extends Component {
    componentDidMount() {
        if(this.canvas) this.redraw()
    }
    componentWillReceiveProps(newProps) {
        if(this.canvas) this.redraw()
    }
    redraw() {
        QRCode.toCanvas(this.canvas,this.props.url,{ width:this.props.width, height:this.props.height });
    }
    render() {
        let style = {}
        if(this.props.style) Object.assign(style,this.props.style)
        return <canvas width={this.props.width} height={this.props.height} ref={(canvas)=>this.canvas=canvas} style={style}/>
    }
}