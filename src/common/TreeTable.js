import React, { Component } from 'react';
import selMan, {SELECTION_MANAGER} from "../SelectionManager";
import {TREE_ITEM_PROVIDER} from '../TreeItemProvider';
import {PopupManager, VBox} from "appy-comps";
import {fetchGraphObject, removeFromParent} from "../syncgraph/utils";
import {Spacer} from './GridEditorApp'


const ContextMenu = (props) => {
    return <VBox className={"popup-menu"}>
        {props.menu.map((item,i)=>{
            if(item.divider) return <div className="divider" key={i}></div>
            let enabled = false
            if(typeof item.enabled === 'undefined') enabled = true
            if(item.enabled === true) enabled = true
            return <button key={i}
                           disabled={!enabled}
                           onClick={()=>{
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
        selMan.setSelection(this.props.node)
        if(this.props.provider.calculateContextMenu) {
            const menu = this.props.provider.calculateContextMenu(this.props.node)
            PopupManager.show(<ContextMenu menu={menu}/>,e.target)
        }
    }
    toggleItemCollapsed = (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.props.provider.toggleItemCollapsed(this.props.node);
    }
    onDragStart = (e) => {
        this.props.onDragStart(e,this.props.node)
    }
    onDragOver = (e) => {
        this.props.onDragOver(e,this.props.node)
    }
    onDragEnd = (e) => {
        this.props.onDragEnd(e,this.props.node)
    }
    onDrop = (e) => {
        this.props.onDrop(e,this.props.node)
    }
    render() {
        let cls = "tree-node";
        const node = this.props.node
        if (selMan.isSelected(node)) cls += " selected"
        if (selMan.getDropTarget() === node) {
            cls += " drop-target"
            if(selMan.getDropType() === 'parent') cls += " drop-parent"
        }
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

        return <div className={cls}
                    onClick={this.onSelect}
                    onContextMenu={this.onContextMenu}
                    data-nodeid={node.id}
                    onDragOver={this.onDragOver}
                    onDrop={this.onDrop}
        >
            <span style={{
                width:this.props.depth*1.5+'em'
            }}></span>
            {arrow}
            {prov.getRendererForItem(node)}
            <Spacer/>
            {this.renderDragBars()}
        </div>
    }

    renderDragBars() {
        if(this.props.provider.canBeMoved && !this.props.provider.canBeMoved(this.props.node))  return ""
        return <span className={"drag fa fa-bars"}
              draggable
              onDragStart={this.onDragStart}
              onDragEnd={this.onDragEnd}
        />

    }
}



export default class TreeTable extends Component {
    constructor(props) {
        super(props)
        this.state = {
            root:this.props.root,
            dropTarget:null,
            selection:null,
            dragTarget:null,
            internalDrag:false,
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

    onDragStart = (e,item) => {
        console.log('starting to drag the item',item)
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/html", e.target.parentNode);
        e.dataTransfer.setDragImage(e.target.parentNode, 20, 20);
        e.dataTransfer.dropEffect = 'move'
        this.setState({dragTarget:item, internalDrag:true})
    }
    onDragOver = (e,item) => {
        if(!this.state.internalDrag) {
            e.preventDefault()
            if(this.props.provider.canAddExternalChild(item,e.dataTransfer)) {
                selMan.setDropTarget(item)
                selMan.setDropType('parent')
            } else {
                selMan.setDropType(null)
                selMan.setDropTarget(null)
            }
            return
        }
        const prov = this.props.provider
        if(prov.canAddChild(item,this.state.dragTarget)) {
            //use the rop target as a parent
            selMan.setDropTarget(item)
            selMan.setDropType('parent')
            return
        } else if(prov.canBeSibling(item,this.state.dragTarget)) {
            //use the drop target as a sibling
            selMan.setDropType('sibling')
            selMan.setDropTarget(item)
        } else {
            //no valid target
            selMan.setDropType(null)
            selMan.setDropTarget(null)
        }
    }
    onDragEnd = (e,item) => {
        //handle external case
        if(!this.state.internalDrag){
            this.setState({dragTarget:null, internalDrag:false})
            e.preventDefault()
            e.stopPropagation()
            return
        }

        const graph = this.props.provider.getDataGraph()
        if(!this.state.dragTarget) return
        if(!this.state.dropTarget) return
        const src = fetchGraphObject(graph,this.state.dragTarget)
        const dst = fetchGraphObject(graph,this.state.dropTarget)


        //can't drop onto self
        if(dst.id === src.id) {
            this.setState({dragTarget:null, internalDrag:false})
            selMan.setDropTarget(null)
            return
        }


        //remove from old location
        removeFromParent(graph,src)

        const dt = selMan.getDropType()
        if(dt === 'parent') {
            graph.setProperty(src.id,'parent',dst.id)
            graph.insertAfter(dst.children,null,src.id)
        } else {
            const parent2 = fetchGraphObject(graph,dst.parent)
            graph.setProperty(src.id, 'parent', parent2.id)
            graph.insertAfter(parent2.children, dst.id, src.id)
        }
        this.setState({dragTarget:null})
        selMan.setDropTarget(null)
    }
    onDrop = (e,item) => {
        if(!this.state.internalDrag) {
            e.stopPropagation()
            e.preventDefault()
            this.props.provider.acceptDrop(e,item)
            this.setState({internalDrag:false, dragTarget:null})
        }
        // var data = e.dataTransfer.getData("text/html");
        // console.log('the dropped data is',data)
    }
    render() {
        if(!this.state.root) return <ul>no root yet</ul>
        const children = [];
        this.generateChildren(this.state.root,children,0)
        return <ul className='tree-table'>
            {children.map((info,i)=>{
                return <TreeTableItem key={i}
                                      node={info.node}
                                      depth={info.depth}
                                      provider={this.props.provider}
                                      selection={this.state.selection}
                                      onDragStart={this.onDragStart}
                                      onDragOver={this.onDragOver}
                                      onDragEnd={this.onDragEnd}
                                      onDrop={this.onDrop}
                />
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

