// СИНАПС — нативное приложение (Expo).
// Локальное хранилище: данные не теряются при закрытии. Бэкенда нет.
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, Modal,
  StyleSheet, StatusBar, Platform, KeyboardAvoidingView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NeuronScene from "./src/NeuronScene";

const STORAGE_KEY = "synapse_state_v1";

const PRIO = {
  high: { c: "#ff5765", label: "Важный" },
  med:  { c: "#f0b232", label: "Средний" },
  low:  { c: "#4fd1ad", label: "Не срочный" },
};
const SELF = "#e7eef2";
const order = ["high", "med", "low"];
const colorOf = (p) => (p.id === "you" ? SELF : (PRIO[p.priority]?.c || PRIO.med.c));

const SEED = {
  you:  { id:"you",  name:"Ты",    priority:null,   role:"это ты",           phone:"", comment:"", links:["mira","lev","nika","arman"] },
  mira: { id:"mira", name:"Мира",  priority:"high", role:"Продакт-дизайнер", phone:"+7 900 110-22-33", comment:"Помогает с интерфейсом", links:["you","dasha","oleg"] },
  lev:  { id:"lev",  name:"Лев",   priority:"med",  role:"Бэкенд-инженер",   phone:"+7 905 444-55-66", comment:"Делал API на прошлом проекте", links:["you","kira","arman"] },
  nika: { id:"nika", name:"Ника",  priority:"high", role:"Инвестор, ангел",  phone:"+7 921 777-88-99", comment:"Заинтересована в early-stage", links:["you","sonya"] },
  arman:{ id:"arman",name:"Арман", priority:"low",  role:"Однокурсник",      phone:"", comment:"Давно не общались", links:["you","lev","tim"] },
  dasha:{ id:"dasha",name:"Даша",  priority:"med",  role:"Маркетолог",       phone:"+7 903 000-11-22", comment:"", links:["mira","sonya"] },
  oleg: { id:"oleg", name:"Олег",  priority:"low",  role:"Фотограф",         phone:"", comment:"", links:["mira"] },
  kira: { id:"kira", name:"Кира",  priority:"high", role:"Юрист по IT",      phone:"+7 916 333-22-11", comment:"Поможет с договорами", links:["lev","tim"] },
  sonya:{ id:"sonya",name:"Соня",  priority:"med",  role:"HR, рекрутер",     phone:"", comment:"Ищет команды", links:["nika","dasha"] },
  tim:  { id:"tim",  name:"Тим",   priority:"low",  role:"Друг детства",     phone:"", comment:"", links:["arman","kira"] },
};

function degreesFrom(g,s,t){ if(s===t)return 0; const seen=new Set([s]); let fr=[s],d=0;
  while(fr.length){ d++; const nx=[]; for(const id of fr) for(const n of (g[id]?.links||[])){ if(n===t)return d; if(!seen.has(n)){seen.add(n);nx.push(n);} } fr=nx; } return Infinity; }
function plural(n){ const a=Math.abs(n)%100,b=a%10; if(a>10&&a<20)return"рукопожатий"; if(b===1)return"рукопожатие"; if(b>1&&b<5)return"рукопожатия"; return"рукопожатий"; }

export default function App(){
  const [loaded,setLoaded]=useState(false);
  const [screen,setScreen]=useState("intro");
  const [name,setName]=useState("");
  const [graph,setGraph]=useState(SEED);
  const [focus,setFocus]=useState("you");
  const [selected,setSelected]=useState(null);
  const [addTarget,setAddTarget]=useState(null);
  const [form,setForm]=useState({name:"",role:"",phone:"",comment:"",priority:"med"});

  // загрузка сохранённого состояния
  useEffect(()=>{ (async()=>{
    try{ const raw=await AsyncStorage.getItem(STORAGE_KEY);
      if(raw){ const s=JSON.parse(raw);
        if(s.graph) setGraph(s.graph);
        if(s.name) setName(s.name);
        if(s.focus) setFocus(s.focus);
        setScreen(s.onboarded ? "net" : "intro");
      }
    }catch(e){ console.warn("load error",e); }
    setLoaded(true);
  })(); },[]);

  // сохранение при любом изменении (после первичной загрузки)
  useEffect(()=>{ if(!loaded) return;
    const payload=JSON.stringify({ graph, name, focus, onboarded: screen==="net" });
    AsyncStorage.setItem(STORAGE_KEY, payload).catch(e=>console.warn("save error",e));
  },[graph,name,focus,screen,loaded]);

  const me=graph.you;
  const handshakes=useMemo(()=>selected?degreesFrom(graph,"you",selected):null,[graph,selected]);

  const register=()=>{ if(name.trim()) setGraph(g=>({...g,you:{...g.you,name:name.trim()}})); setScreen("net"); };
  const openAdd=(t)=>{ setAddTarget(t); setForm({name:"",role:"",phone:"",comment:"",priority:"med"}); };
  const submitAdd=()=>{ const nm=form.name.trim(); if(!nm)return; const id="p"+Math.random().toString(36).slice(2,8);
    setGraph(g=>({...g,
      [id]:{id,name:nm,role:form.role.trim(),phone:form.phone.trim(),comment:form.comment.trim(),priority:form.priority,links:[addTarget]},
      [addTarget]:{...g[addTarget],links:[...g[addTarget].links,id]} }));
    setAddTarget(null); };
  const deletePerson=(id)=>{ if(id==="you")return;
    setGraph(g=>{ const ng={...g}; delete ng[id]; for(const k in ng) ng[k]={...ng[k],links:ng[k].links.filter(l=>l!==id)}; return ng; });
    if(focus===id) setFocus("you"); setSelected(null); };
  const setPriority=(id,p)=>setGraph(g=>({...g,[id]:{...g[id],priority:p}}));

  const onSelect=useCallback((id)=>setSelected(id),[]);

  if(!loaded) return <View style={st.boot}><Text style={st.bootText}>СИНАПС</Text></View>;

  const isRoot=focus==="you";
  const sel=selected&&graph[selected]?{...graph[selected],color:colorOf(graph[selected])}:null;

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content"/>

      {screen==="intro" && (
        <View style={st.center}>
          <View style={st.orb}/>
          <Text style={st.brand}>СИНАПС</Text>
          <Text style={st.tag}>Каждый знакомый — нейрон.{"\n"}Любой человек в мире — в нескольких рукопожатиях.</Text>
          <Pressable style={st.cta} onPress={()=>setScreen("auth")}><Text style={st.ctaT}>Войти в сеть</Text></Pressable>
        </View>
      )}

      {screen==="auth" && (
        <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={st.center}>
          <View style={st.orbSmall}/>
          <Text style={st.h2}>Как тебя зовут?</Text>
          <Text style={st.sub}>С тебя начинается весь граф</Text>
          <TextInput style={st.input} placeholder="Имя" placeholderTextColor="#5a7383" value={name} onChangeText={setName}/>
          <Pressable style={st.cta} onPress={register}><Text style={st.ctaT}>Создать мой нейрон</Text></Pressable>
        </KeyboardAvoidingView>
      )}

      {screen==="net" && (
        <View style={st.netRoot}>
          {/* 3D-сцена на фоне */}
          <NeuronScene graph={graph} focus={focus} selectedId={selected} onSelect={onSelect}/>

          {/* шапка */}
          <View style={st.topbar} pointerEvents="box-none">
            <View>
              <Text style={st.hello}>СЕТЬ · {me.name}</Text>
              <Text style={st.focusLine}>{isRoot?"Твой круг":`Круг ${graph[focus].name}`}</Text>
            </View>
            {!isRoot && <Pressable style={st.backBtn} onPress={()=>{setFocus("you");setSelected(null);}}><Text style={st.backT}>↺ к себе</Text></Pressable>}
          </View>
          <View style={st.legend} pointerEvents="none">
            {order.map(k=>(<View key={k} style={st.legendItem}><View style={[st.dotSm,{backgroundColor:PRIO[k].c}]}/><Text style={st.legendT}>{PRIO[k].label}</Text></View>))}
          </View>
          <Text style={st.hint} pointerEvents="none">крути пальцем · тапни нейрон</Text>

          {/* карточка выбранного */}
          {sel && (
            <View style={st.card}>
              <View style={st.cardHead}>
                <View style={[st.cardDot,{backgroundColor:sel.color}]}/>
                <View style={{flex:1}}>
                  <Text style={st.cardName}>{sel.name}</Text>
                  <Text style={st.cardRole} numberOfLines={1}>{sel.role||"—"}</Text>
                </View>
                {sel.id!=="you" && <Pressable style={st.iconBtn} onPress={()=>deletePerson(sel.id)}><Text style={st.iconT}>Удалить</Text></Pressable>}
              </View>
              <Text style={st.cardMeta}>{handshakes===0?"это ты":handshakes===Infinity?"пока нет связи":`${handshakes} ${plural(handshakes)} от тебя · ${sel.links.length} связей`}</Text>
              {!!sel.phone && <Text style={st.cardPhone}>{sel.phone}</Text>}
              {!!sel.comment && <Text style={st.cardComment}>{sel.comment}</Text>}
              {sel.id!=="you" && (
                <View style={st.rowGap}>
                  {order.map(k=>(
                    <Pressable key={k} onPress={()=>setPriority(sel.id,k)} style={[st.prioMini,{borderColor:sel.priority===k?PRIO[k].c:"#243341",backgroundColor:sel.priority===k?PRIO[k].c+"28":"transparent"}]}>
                      <View style={[st.dotSm,{backgroundColor:PRIO[k].c}]}/>
                    </Pressable>
                  ))}
                </View>
              )}
              <View style={st.cardActions}>
                <Pressable style={st.ghost} onPress={()=>openAdd(sel.id)}><Text style={st.ghostT}>+ связь</Text></Pressable>
                <Pressable style={st.open} onPress={()=>{setFocus(sel.id);setSelected(null);}}><Text style={st.openT}>Открыть круг →</Text></Pressable>
              </View>
            </View>
          )}

          {/* кнопка добавить */}
          <Pressable style={st.fab} onPress={()=>openAdd(focus)}><Text style={st.fabT}>+</Text></Pressable>
        </View>
      )}

      {/* модалка добавления */}
      <Modal visible={!!addTarget} transparent animationType="slide" onRequestClose={()=>setAddTarget(null)}>
        <Pressable style={st.sheetWrap} onPress={()=>setAddTarget(null)}>
          <Pressable style={st.sheet} onPress={()=>{}}>
            <View style={st.grip}/>
            <Text style={st.sheetTitle}>Новая связь от {addTarget?graph[addTarget]?.name:""}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={{maxHeight:380}}>
              <Lbl t="Имя"/><TextInput style={st.input} placeholder="Как зовут" placeholderTextColor="#5a7383" value={form.name} onChangeText={v=>setForm(f=>({...f,name:v}))}/>
              <Lbl t="Должность / роль"/><TextInput style={st.input} placeholder="Например, дизайнер" placeholderTextColor="#5a7383" value={form.role} onChangeText={v=>setForm(f=>({...f,role:v}))}/>
              <Lbl t="Номер"/><TextInput style={st.input} placeholder="+7 ..." placeholderTextColor="#5a7383" keyboardType="phone-pad" value={form.phone} onChangeText={v=>setForm(f=>({...f,phone:v}))}/>
              <Lbl t="Комментарий"/><TextInput style={[st.input,{height:64}]} placeholder="Чем полезен, где познакомились" placeholderTextColor="#5a7383" multiline value={form.comment} onChangeText={v=>setForm(f=>({...f,comment:v}))}/>
              <Lbl t="Приоритет"/>
              <View style={st.rowGap}>
                {order.map(k=>(
                  <Pressable key={k} onPress={()=>setForm(f=>({...f,priority:k}))} style={[st.chip,{borderColor:form.priority===k?PRIO[k].c:"#243341",backgroundColor:form.priority===k?PRIO[k].c+"28":"transparent"}]}>
                    <View style={[st.dotSm,{backgroundColor:PRIO[k].c}]}/>
                    <Text style={[st.chipT,{color:form.priority===k?PRIO[k].c:"#7e93a3"}]}>{PRIO[k].label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Pressable style={[st.cta,{marginTop:14}]} onPress={submitAdd}><Text style={st.ctaT}>Создать связь →</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const Lbl=({t})=><Text style={st.fieldLabel}>{t}</Text>;

const st=StyleSheet.create({
  boot:{flex:1,backgroundColor:"#06090e",alignItems:"center",justifyContent:"center"},
  bootText:{color:"#5eead4",fontSize:22,letterSpacing:4,fontWeight:"700"},
  root:{flex:1,backgroundColor:"#06090e"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:36,gap:14},
  orb:{width:120,height:120,borderRadius:60,backgroundColor:"#1c8d7e",shadowColor:"#5eead4",shadowOpacity:0.7,shadowRadius:40,shadowOffset:{width:0,height:0},marginBottom:6},
  orbSmall:{width:58,height:58,borderRadius:29,backgroundColor:"#1c8d7e",shadowColor:"#5eead4",shadowOpacity:0.6,shadowRadius:24,marginBottom:6},
  brand:{color:"#e7eef2",fontSize:36,fontWeight:"700",letterSpacing:2},
  tag:{color:"#9bbac9",fontSize:15,lineHeight:23,textAlign:"center"},
  h2:{color:"#e7eef2",fontSize:25,fontWeight:"700"},
  sub:{color:"#8aa7b6",fontSize:14},
  input:{width:"100%",backgroundColor:"#0d1822",borderColor:"#1f3445",borderWidth:1,borderRadius:14,paddingHorizontal:16,paddingVertical:13,color:"#e7eef2",fontSize:16,marginBottom:4},
  fieldLabel:{color:"#7e93a3",fontSize:12,marginTop:12,marginBottom:6},
  cta:{width:"100%",backgroundColor:"#5eead4",borderRadius:15,paddingVertical:15,alignItems:"center"},
  ctaT:{color:"#04221d",fontWeight:"700",fontSize:16},
  netRoot:{flex:1},
  topbar:{position:"absolute",top:54,left:22,right:22,flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",zIndex:10},
  hello:{color:"#5f8294",fontSize:11,letterSpacing:2,fontWeight:"600"},
  focusLine:{color:"#e7eef2",fontSize:22,fontWeight:"700",marginTop:3},
  backBtn:{backgroundColor:"#10202c",borderColor:"#1f3445",borderWidth:1,borderRadius:11,paddingHorizontal:12,paddingVertical:8},
  backT:{color:"#9fd9ce",fontSize:13},
  legend:{position:"absolute",top:108,left:22,flexDirection:"row",gap:16,zIndex:10},
  legendItem:{flexDirection:"row",alignItems:"center",gap:6},
  legendT:{color:"#7e93a3",fontSize:11.5},
  dotSm:{width:9,height:9,borderRadius:5},
  hint:{position:"absolute",bottom:100,left:0,right:0,textAlign:"center",color:"#4d6577",fontSize:11,letterSpacing:1},
  card:{position:"absolute",left:14,right:14,bottom:90,backgroundColor:"rgba(11,20,28,0.96)",borderColor:"#20384a",borderWidth:1,borderRadius:22,padding:16,zIndex:15},
  cardHead:{flexDirection:"row",alignItems:"center",gap:12},
  cardDot:{width:16,height:16,borderRadius:8},
  cardName:{color:"#e7eef2",fontSize:19,fontWeight:"700"},
  cardRole:{color:"#9bbac9",fontSize:13,marginTop:2},
  cardMeta:{color:"#7e93a3",fontSize:12.5,marginTop:8},
  cardPhone:{color:"#cfe3ee",fontSize:14,fontWeight:"600",marginTop:6,letterSpacing:0.4},
  cardComment:{color:"#a9c2d0",fontSize:13,marginTop:8,lineHeight:19,paddingLeft:10,borderLeftColor:"#2a4356",borderLeftWidth:2,fontStyle:"italic"},
  rowGap:{flexDirection:"row",gap:8,marginTop:10},
  prioMini:{flex:1,alignItems:"center",justifyContent:"center",paddingVertical:9,borderRadius:10,borderWidth:1},
  cardActions:{flexDirection:"row",gap:8,marginTop:12},
  ghost:{backgroundColor:"#10202c",borderColor:"#1f3445",borderWidth:1,borderRadius:12,paddingHorizontal:14,paddingVertical:11},
  ghostT:{color:"#9fd9ce",fontSize:13,fontWeight:"600"},
  open:{flex:1,backgroundColor:"#5eead4",borderRadius:12,paddingVertical:11,alignItems:"center"},
  openT:{color:"#04221d",fontWeight:"700",fontSize:13.5},
  iconBtn:{borderColor:"#3a2630",borderWidth:1,borderRadius:10,paddingHorizontal:12,paddingVertical:8},
  iconT:{color:"#ff8a93",fontSize:13},
  fab:{position:"absolute",right:22,bottom:24,width:60,height:60,borderRadius:30,backgroundColor:"#5eead4",alignItems:"center",justifyContent:"center",zIndex:20},
  fabT:{color:"#04221d",fontSize:30,fontWeight:"700",lineHeight:34},
  sheetWrap:{flex:1,backgroundColor:"rgba(2,5,9,0.6)",justifyContent:"flex-end"},
  sheet:{backgroundColor:"#0b141c",borderTopLeftRadius:28,borderTopRightRadius:28,padding:22,borderTopColor:"#20384a",borderTopWidth:1},
  grip:{width:44,height:5,borderRadius:3,backgroundColor:"#2a4356",alignSelf:"center",marginBottom:12},
  sheetTitle:{color:"#e7eef2",fontSize:18,fontWeight:"700",marginBottom:8},
  chip:{flex:1,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,paddingVertical:11,borderRadius:12,borderWidth:1},
  chipT:{fontSize:12.5,fontWeight:"600"},
});
