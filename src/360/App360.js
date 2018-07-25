import React, {Component} from 'react'
import {Toolbar, Panel, Spacer, MenuPopup} from '../GridEditorApp'
import TreeTable from '../TreeTable'
import {DialogManager, DialogContainer, Dialog, HBox, VBox, PopupManager} from "appy-comps"
import GridEditorApp from '../GridEditorApp'
import Editor360Canvas2D from './Editor360Canvas2D'
import PropSheet from '../PropSheet'
import {SERVER_URL, SERVER_URL_ASSETS} from '../TreeItemProvider'
import InputManager from "../common/InputManager";
import UndoManager from "../common/UndoManager";
import {PRIMS, TYPES} from "./Editor360Editor";
import ReactGA from 'react-ga'
import JSZip from "jszip"
import {saveAs} from "file-saver/FileSaver"

export default class App360 extends Component {
    constructor(props) {
        super(props)

        this.im = new InputManager();
        this.im.addKeyBinding({
            id:'save',
            key:InputManager.KEYS.S,
            modifiers:[InputManager.MODIFIERS.COMMAND]
        })
        this.im.addListener('save',this.save)
        this.uman = new UndoManager(this.prov())
        ReactGA.pageview('/360/')
    }

    componentDidMount() {
        this.im.attachKeyEvents(document)
    }

    prov = () => this.props.provider

    render() {
        return <GridEditorApp provider={this.prov()}>
            <Toolbar left top>
                <label>{this.prov().getTitle()}</label>
            </Toolbar>
            <Panel scroll left middle>
                <TreeTable root={this.prov().getSceneRoot()} provider={this.prov()}/>
            </Panel>

            <Toolbar left bottom>
                <button className="fa fa-globe" onClick={this.addScene}>Scene</button>
                <button className="fa fa-plus" onClick={this.showAddAssetMenu}>Asset</button>
                <button className="fa fa-close" onClick={this.deleteSelectedAsset}>asset</button>
            </Toolbar>

            <Toolbar center top>
                <button className="fa fa-plus" onClick={this.showAddPopupMenu}>Object</button>
                <button className="fa fa-plus" onClick={this.showAddActionMenu}>Action</button>
                <button className="fa fa-close" onClick={this.deleteObject}/>
                <Spacer/>
                {/*<button className="fa fa-save" onClick={this.save} disabled={!this.state.dirty}/>*/}
                <button className="fa fa-undo" onClick={this.undo}/>
                <button className="fa fa-repeat" onClick={this.redo}/>
                <Spacer/>
                <button className="fa fa-play" onClick={this.preview}/>
                <button className="fa fa-save" onClick={this.save}/>
                <button className="fa fa-download" onClick={this.exportProject}/>
            </Toolbar>

            <Panel center middle scroll>
                <Editor360Canvas2D provider={this.prov()}/>
            </Panel>

            <Toolbar right top>
                <label>Properties</label>
            </Toolbar>
            <Panel scroll right>
                <PropSheet provider={this.prov()}/>
            </Panel>
            <DialogContainer/>
        </GridEditorApp>
    }
    showAddPopupMenu = (e) => {
        const acts = Object.keys(PRIMS).map((key) => {
            const info = PRIMS[key]
            return {
                title:info.title,
                icon:info.icon,
                fun:() => this.prov().appendChild(this.prov().findSelectedLayer(),info.make(this.prov()))
            }
        })
        acts.unshift({
            title:'Layer',
            icon:'window-maximize',
            fun: this.addLayer
        })
        PopupManager.show(<MenuPopup actions={acts}/>,e.target)
    }
    showAddActionMenu = (e) => {
        const acts = [
            {
                title:'Go to...',
                icon:'arrow-right',
                fun: this.addNavAction
            },
            {
                title:'Play Sound',
                icon:'play',
                fun: this.addPlaySoundAction
            }
        ]
        PopupManager.show(<MenuPopup actions={acts}/>,e.target)
    }
    showAddAssetMenu = (e) => {
        const acts = [
            {
                title: '2D Image',
                icon:'file-photo-o',
                fun: this.upload2DImage
            },
            {
                title: '360 Image',
                icon:'file-image-o',
                fun: this.upload360Image
            },
            {
                title:'Sound',
                icon:'file-audio-o',
                fun: this.uploadSound
            },
            {
                title:'GLTF from URL',
                icon:'file-text-o',
                fun: this.addGLTFURLAsset,
            }
        ]
        PopupManager.show(<MenuPopup actions={acts}/>,e.target)
    }

    addScene  = () => this.prov().appendChild(this.prov().getScenesRoot(),this.prov().createScene())
    addLayer  = () => this.prov().appendChild(this.prov().findSelectedScene(),this.prov().createLayer())
    addNavAction = () => this.prov().appendChild(this.prov().findSelectedPrimitive(), this.prov().createNavAction())
    addPlaySoundAction = () => this.prov().appendChild(this.prov().findSelectedPrimitive(), this.prov().createPlaySoundAction())
    deleteObject = () => this.prov().deleteChild(this.prov().findSelectedNode())
    preview   = () => {
        ReactGA.event({action:'preview',doc:this.prov().getDocId()})
        const win = window.open()
        const location = `./viewer.html?mode=preview&doctype=${this.prov().getDocType()}&doc=${this.prov().getDocId()}`
        this.save().then(()=> win.location = location)
    }
    save = () => this.prov().save()
    exportProject = () => {
        this.prov().save().then(()=>{
            const zip = new JSZip()
            const folder = zip.folder('project')

            function fetchAsBlob(url) {
                return fetch(url).then(r => {
                    if (r.status === 200) return r.blob()
                    return Promise.reject(new Error(r.statusText))
                })
            }

            this.prov().getAssetsRoot().children.map(asset => {
                let url = null
                if(asset.resourceType === TYPES.ASSETS.GLTF_URL) {
                    url = asset.url
                }else {
                    url = SERVER_URL_ASSETS+asset.resourceId
                }
                const name = url.substring(url.lastIndexOf('/'))
                console.log('adding',name,url)
                folder.file(name, fetchAsBlob(url))
            })

            folder.file('viewer.html',fetchAsBlob("./viewer.html"))
            folder.file('viewer.js',fetchAsBlob("./viewer.js"))
            folder.file('doc.json',fetchAsBlob(SERVER_URL+this.prov().getDocId()))

            zip.generateAsync({type:"blob"})
                .then(blob => saveAs(blob, 'project.zip'))
                .catch(e => console.log(e));
        })
    }
    undo = () => this.uman.undo()
    redo = () => this.uman.redo()
    upload2DImage  = () => DialogManager.show(<UploadAssetDialog provider={this.prov()}
                                                                 title={"Upload 2D Image"}
                                                                 resourceType={TYPES.ASSETS.IMAGE2D}/>)
    uploadSound  = () => DialogManager.show(<UploadAssetDialog provider={this.prov()}
                                                               title={"Upload Sound"}
                                                               resourceType={TYPES.ASSETS.AUDIO}/>)
    upload360Image = () => DialogManager.show(<UploadAssetDialog provider={this.prov()}
                                                                 title={"Upload 360 Image"}
                                                                 resourceType={TYPES.ASSETS.IMAGE360}/>)
    addGLTFURLAsset = () => DialogManager.show(<AddGLTFFromURLDialog provider={this.prov()}
                                                                     title={"Add a GLTF from a URL"}/>)
    deleteSelectedAsset = () => this.prov().deleteChild(this.prov().findSelectedAsset())

}


class UploadAssetDialog extends Component {
    constructor(props) {
        super(props)
        this.state = {
            file: null,
            filename:'',
            name: 'unnamed asset'
        }
    }
    choseFile = (e) => {
        this.setState({
            file:e.target.files[0],
            filename:e.target.files[0].name
        })
    }
    editedName = (e) => {
        this.setState({name:e.target.value})
    }
    uploadFile = () => {
        this.props.provider.uploadFile(this.state.file).then((resource)=>{
            const asset = this.props.provider.createAssetWithInfo({
                id:resource.id,
                title:this.state.name,
                resourceType:this.props.resourceType
            })
            this.props.provider.appendChild(this.props.provider.getAssetsRoot(),asset)
            DialogManager.hide()
        })
    }
    cancel = () => {
        DialogManager.hide()
    }
    render() {
        return <Dialog visible={true}>
            <header>{this.props.title}</header>
            <VBox>
                <HBox>
                    <label>name</label>
                    <input type="text" value={this.state.name} onChange={this.editedName}/>
                </HBox>
                <HBox>
                    <label>file</label>
                    <input type="file" onChange={this.choseFile}/>
                    <label>{this.state.filename}</label>
                </HBox>
            </VBox>

            <footer>
                <button onClick={this.cancel}>cancel</button>
                <button onClick={this.uploadFile}>upload</button>
            </footer>
        </Dialog>
    }
}


class AddGLTFFromURLDialog extends Component {
    constructor(props) {
        super(props);
        this.state = {
            name:'unnamed GLTF model',
            url:''
        }
    }
    editedName = (e) => this.setState({name:e.target.value})
    editedURL = (e) => this.setState({url:e.target.value})
    cancel = () => DialogManager.hide()
    add = () => {
        const asset = this.props.provider.createAssetWithURLInfo({
            title:this.state.name,
            resourceType:TYPES.ASSETS.GLTF_URL,
            url: this.state.url
        })
        this.props.provider.appendChild(this.props.provider.getAssetsRoot(),asset)
        DialogManager.hide()
    }

    render() {
        return <Dialog visible={true}>
            <header>{this.props.title}</header>
            <VBox>
                <HBox>
                    <label>name</label>
                    <input type="text" value={this.state.name} onChange={this.editedName}/>
                </HBox>
                <HBox>
                    <label>URL</label>
                    <input type="text" value={this.state.url} onChange={this.editedURL}/>
                </HBox>
            </VBox>

            <footer>
                <button onClick={this.cancel}>cancel</button>
                <button onClick={this.add}>add</button>
            </footer>
        </Dialog>

    }
}