import React, { Component } from 'react';
import selMan, {SELECTION_MANAGER} from "../SelectionManager";
import {TREE_ITEM_PROVIDER} from '../TreeItemProvider';
import {PopupManager, VBox} from "appy-comps";


const ContextMenu = (props) => {
    return <VBox className={"popup-menu"}>
        {props.menu.map((item,i)=>{
            return <button key={i} onClick={()=>{
                PopupManager.hide()
                if(item.fun) item.fun()
            }}
            ><i className={'fa fa-'+item.icon}/> {item.title}</button>
        })}
    </VBox>
}

class TreeTableItem extends Component {
    onSelect = (e)=>  {
        if(e.shiftKey) {
            selMan.addToSelection(this.props.node)
        } else {
            selMan.setSelection(this.props.node)
        }
    }
    onContextMenu = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if(this.props.provider.calculateContextMenu) {
            const menu = this.props.provider.calculateContextMenu()
            PopupManager.show(<ContextMenu menu={menu}/>,e.target)
        }
    }
    toggleItemCollapsed = (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.props.provider.toggleItemCollapsed(this.props.node);
    }
    render() {
        let cls = "tree-node";
        const node = this.props.node
        if (selMan.isSelected(node)) {
            cls += " selected"
        }
        if (selMan.getDropTarget() === node) cls += " drop-target"
        let arrow = "";
        const prov = this.props.provider
        if (prov.hasChildren(node)) {
            const expanded = prov.isExpanded(node)
            if (expanded) {
                arrow = <button className="fa fa-caret-down fa-fw borderless" onClick={this.toggleItemCollapsed}/>;
            } else {
                arrow = <button className="fa fa-caret-right fa-fw borderless" onClick={this.toggleItemCollapsed}/>;
            }
        } else {
            arrow = <span className="fa fa-fw borderless"/>
        }

        return <div className={cls} onClick={this.onSelect} onContextMenu={this.onContextMenu} data-nodeid={node.id}>
            <span style={{
                width:this.props.depth*1+'em'
            }}></span>
            {arrow}
            {prov.getRendererForItem(node)}
        </div>
    }
}



export default class TreeTable extends Component {
    constructor(props) {
        super(props)
        this.state = {
            root:this.props.root,
            dropTarget:null,
            selection:null
        }
    }
    componentDidMount() {
        this.listener = this.props.provider.on(TREE_ITEM_PROVIDER.EXPANDED_CHANGED,
            (item)=>  this.setState({root:this.props.provider.getSceneRoot()}))
        this.props.provider.on(TREE_ITEM_PROVIDER.STRUCTURE_ADDED,
            (item)=>  this.setState({root:this.props.provider.getSceneRoot()}))
        this.props.provider.on(TREE_ITEM_PROVIDER.STRUCTURE_CHANGED,
            (item)=>  this.setState({root:this.props.provider.getSceneRoot()}))

        this.other_listener = selMan.on(SELECTION_MANAGER.CHANGED, (sel)=> this.setState({selection:sel}))
        selMan.on(SELECTION_MANAGER.DROP_TARGET_CHANGED, (sel) => this.setState({dropTarget:selMan.getDropTarget()}))
    }
    componentWillUnmount() {
        this.props.provider.off(TREE_ITEM_PROVIDER.EXPANDED_CHANGED, this.listener)
        selMan.off(SELECTION_MANAGER.CHANGED,this.other_listener)
    }
    componentWillReceiveProps(newProps) {
        if(newProps.root) this.setState({root:newProps.root})
    }

    render() {
        if(!this.state.root) return <ul>no root yet</ul>
        const children = [];
        this.generateChildren(this.state.root,children,0)
        return <ul className='tree-table'>
            {children.map((info,i)=>{
                return <TreeTableItem key={i} node={info.node} depth={info.depth}
                                         provider={this.props.provider}
                                         selection={this.state.selection}/>
            })}
        </ul>
    }

    generateChildren = (root, chs,depth) => {
        const prov = this.props.provider
        chs.push({node:root, depth:depth})
        if(!prov.hasChildren(root)) return
        if(!prov.isExpanded(root)) return;
        prov.getChildren(root).forEach((child)=>{
            this.generateChildren(child,chs,depth+1)
        })
    }
}

