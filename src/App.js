import React, { Component } from 'react';
import './App.css';
import PropSheet from './PropSheet'
import TreeTable from "./TreeTable";
import TreeItemProvider, {TREE_ITEM_PROVIDER} from './TreeItemProvider';

const data = {
    root: {
        title:'root',
        type:'scene',
        children:[
            {
                type:'rect',
                title:'rect1',
                x:20,
                y:30,
                w:40,
                h:40,
                color:'red',
                visible:true,
                children:[]
            },
            {
                type:'rect',
                title:'rect2',
                x:200,
                y:30,
                w:40,
                h:40,
                color:'green',
                visible:false,
            },
            {
                type:'circle',
                title:'next circle',
                cx:100,
                cy:300,
                r:40,
                color:'blue',
                visible:true,
            }
        ]
    },
};

const SceneItemRenderer = (props) => {
    const type = props.item.type;
    if(type === 'rect')   return <div><i className="fa fa-square"/> {props.item.title}</div>
    if(type === 'circle') return <div><i className="fa fa-circle"/> {props.item.title}</div>
    if(type === 'scene')  return <div><i className="fa fa-diamond"/> {props.item.title}</div>
    return <div>unknown item type</div>
}

class SceneTreeItemProvider extends TreeItemProvider {
    constructor(root) {
        super();
        this.root = root;
        this.expanded_map = {};
        this.listeners = {};
    }
    on(type,cb) {
        if(!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(cb);
    }
    fire(type, value) {
        if(!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].forEach((cb) => cb(value));
    }
    getSceneRoot() {
        return this.root;
    }
    getRendererForItem(item) {
        return <SceneItemRenderer item={item}/>
    }
    isExpanded(item) {
        if(!item.id) item.id = ""+Math.random();
        if(typeof this.expanded_map[item.id] === 'undefined') this.expanded_map[item.id] = true;
        return this.expanded_map[item.id];
    }
    hasChildren(item) {
        return (item.children && item.children.length>0)
    }
    getChildren(item) {
        return item.children;
    }
    toggleItemCollapsed(item) {
        const current = this.isExpanded(item);
        this.expanded_map[item.id] = !current;
        this.fire(TREE_ITEM_PROVIDER.EXPANDED_CHANGED,item);
    }
    getProperties(item) {
        var defs = [];
        if(!item) return defs;
        Object.keys(item).forEach((key)=>{
            if(key === 'children') return;
            let type = 'string';
            let locked = false;
            if(key === 'visible') type = 'boolean';
            if(key === 'type') locked = true;
            if(key === 'x') type = 'number';
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

const SM = new SceneTreeItemProvider(data.root);

const GridLayout = (props) => {
    return <div className='grid'>{props.children}</div>
};
const Toolbar = (props) => {
    let cls = "toolbar";
    if(props.left) cls+= " left";
    if(props.right) cls+= " right";
    if(props.bottom) cls+= " bottom";
    if(props.top) cls+= " top";
    if(props.scroll) cls+= " scroll";
    return <div className={cls}>{props.children}</div>
};
const Panel = (props) => {
    let cls = 'panel';
    if(props.left) cls+= " left";
    if(props.right) cls+= " right";
    if(props.bottom) cls+= " bottom";
    if(props.top) cls+= " top";
    if(props.scroll) cls+= " scroll";
    return <div className={cls}>{props.children}</div>
};
const Spacer = (props) => {
    return <span className='spacer'/>
};

class CanvasSVG extends Component {
    constructor(props) {
        super(props);
        this.state = {
            root:null
        }
    }
    componentDidMount() {
        this.listener = SM.on(TREE_ITEM_PROVIDER.PROPERTY_CHANGED, (prop) => this.setState({root:SM.getSceneRoot()}))
        this.setState({root:SM.getSceneRoot()})
    }
    render() {
        function drawChildren(item) {
            return item.children.map((it, i) => {
                return drawSVG(it, i)
            })
        }

        function drawSVG(item, key) {
            if(!item) return "";
            if (item.type === 'scene') {
                return <svg key={key} viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">{drawChildren(item)}</svg>
            }
            if (item.type === 'rect') {
                return <rect x={item.x} y={item.y} width={item.w} height={item.h} fill={item.color} key={key} visibility={item.visible?'visible':'hidden'}/>
            }
            if (item.type === 'circle') {
                return <circle cx={item.cx} cy={item.cy} r={item.r} fill={item.color} key={key}/>
            }
        }

        return <div className=''>{drawSVG(this.state.root, 0)}</div>
    }
}

class App extends Component {
  render() {
    return (
        <GridLayout>
            <Toolbar left top>
                <h3>a really cool 3d editor</h3>
            </Toolbar>
            <Panel scroll left>
                <TreeTable root={data.root} provider={SM}/>
            </Panel>
            <Toolbar left bottom>
                <button className="fa fa-plus-circle"/>
                <button className="fa fa-minus-circle"/>
            </Toolbar>

            <Toolbar center top>
                <label>views</label>
                <button className="fa fa-camera"/>
                <button className="fa fa-object-group"/>
                <button className="fa fa-object-ungroup"/>
            </Toolbar>

            <Panel center middle scroll>
                <CanvasSVG/>
            </Panel>

            <Toolbar center bottom>
                <button className="fa fa-caret-left" onClick={this.toggleLeftPane}/>
                <Spacer/>
                <label>saved or not</label>
                <Spacer/>
                <button className="fa fa-caret-right" onClick={this.toggleRightPane}/>
            </Toolbar>

            <Toolbar right top>
                <label>item</label>
                <label>name</label>
            </Toolbar>
            <Panel scroll right>
                <PropSheet provider={SM}/>
            </Panel>
            <Toolbar right bottom>
                <label>some random extra stuff here</label>
            </Toolbar>
        </GridLayout>
    );
  }
}

export default App;
