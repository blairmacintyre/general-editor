import React, {Component} from 'react'
import {DialogManager, HBox, VBox} from 'appy-comps'
import {listToArray} from '../../syncgraph/utils'
import {ToggleButton, Toolbar} from '../../common/GridEditorApp'
import {addImageAssetFromFile, addImageAssetFromURL} from '../AssetActions'
import {Dialog} from '../../common/Dialog'

export class AddImageAssetDialog extends Component {
    constructor(props) {
        super(props)
        this.state = {
            view:'local',
            url:"",
        }
        this.fileInput = React.createRef();
    }

    cancel = () => {
        DialogManager.hide()
    }
    okay = () => {
        DialogManager.hide()
        if(this.state.view === 'remote') {
            console.log("adding the url",this.state.url)
            addImageAssetFromURL(this.state.url, this.props.provider)
        } else {
            console.log("the file input is",this.fileInput)
            listToArray(this.fileInput.current.files).forEach(file => {
                addImageAssetFromFile(file, this.props.provider)
            })
        }
    }
    switchLocal = () => this.setState({view:'local'})
    switchRemote = () => this.setState({view:'remote'})

    render() {
        return <Dialog visible={true} onScrimClick={this.cancel}>
            <VBox grow>
                <h3>add image to assets</h3>
                <VBox grow>
                    <Toolbar>
                        <ToggleButton onClick={this.switchLocal} selected={this.state.view==='local'}>local</ToggleButton>
                        <ToggleButton onClick={this.switchRemote} selected={this.state.view==='remote'}>remote</ToggleButton>
                    </Toolbar>
                    {this.renderSelectedPanel()}
                </VBox>
                <HBox>
                    <button onClick={this.cancel}>cancel</button>
                    <button onClick={this.okay}>okay</button>
                </HBox>
            </VBox>
        </Dialog>
    }

    selectedFile = (e) => {
        this.setState({fileInput:e.target.value})
    }

    typedURL = (e) => {
        this.setState({url:e.target.value})
    }

    renderSelectedPanel() {
        if(this.state.view === 'local') {
            return <HBox>
                <label>File
                    <input key="f1" type="file" onChange={this.selectedFile} ref={this.fileInput}/>
                </label>
            </HBox>
        } else {
            return <HBox>
                <label>URL
                    <input key="f2" value={this.state.url} type="input" onChange={this.typedURL}/>
                </label>
            </HBox>
        }
    }
}
