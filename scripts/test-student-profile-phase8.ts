import assert from "node:assert/strict";
import test from "node:test";
import type {SessionPayload,SchoolOption} from "../apps/mobile/src/api.js";
import {
  studentPasswordChangeAllowed,studentPasswordResultBelongsToSession
} from "../apps/mobile/src/student-profile-model.js";
import {parentPasswordValidation} from "../apps/mobile/src/parent-more-model.js";

const school={id:"school-1",name:"School",code:"S1",province:"Kabul",
  city:"Kabul",imageUrl:null,defaultLanguage:"fa-AF"} as SchoolOption;
const session={
  accessToken:"access-1",refreshToken:"refresh-1",
  user:{id:"student-1",schoolId:"school-1",username:"student",
  role:"STUDENT",status:"ACTIVE",mustChangePassword:false},
  mustChangePassword:false
} as SessionPayload;

test("Student Phase 8 only active and enrolled students change password",()=>{
  assert.equal(studentPasswordChangeAllowed(session,school,"student-more",false),true);
  assert.equal(studentPasswordChangeAllowed(session,school,"home",false),false);
  assert.equal(studentPasswordChangeAllowed(session,school,"student-more",true),false);
  assert.equal(studentPasswordChangeAllowed(null,school,"student-more",false),false);
  assert.equal(studentPasswordChangeAllowed(session,null,"student-more",false),false);
  assert.equal(studentPasswordChangeAllowed({
    ...session,user:{...session.user,role:"PARENT"}
  },school,"student-more",false),false);
  assert.equal(studentPasswordChangeAllowed({
    ...session,user:{...session.user,status:"SUSPENDED"}
  },school,"student-more",false),false);
  assert.equal(studentPasswordChangeAllowed({
    ...session,mustChangePassword:true
  },school,"student-more",false),false);
  assert.equal(studentPasswordChangeAllowed(session,{...school,id:"other"},"student-more",false),false);
});

test("Student Phase 8 changed session must match exact pre-request session epoch",()=>{
  const changed={...session,accessToken:"access-2",refreshToken:"refresh-2"};
  assert.equal(studentPasswordResultBelongsToSession(
    session,session,school,school,changed),true);
  assert.equal(studentPasswordResultBelongsToSession(
    {...session,accessToken:"old"},session,school,school,changed),false);
  assert.equal(studentPasswordResultBelongsToSession(
    null,session,school,school,changed),false);
  assert.equal(studentPasswordResultBelongsToSession(
    session,session,{...school,id:"changed"},school,changed),false);
  assert.equal(studentPasswordResultBelongsToSession(session,session,school,school,{
    ...changed,user:{...session.user,id:"other"}
  }),false);
  assert.equal(studentPasswordResultBelongsToSession(session,session,school,school,{
    ...changed,user:{...session.user,role:"PARENT"}
  }),false);
});

test("Student Phase 8 password policy validates current, matching and strong passwords",()=>{
  assert.equal(parentPasswordValidation("OldPass1!","NewPass2#","NewPass2#"),null);
  assert.equal(parentPasswordValidation("","NewPass2#","NewPass2#"),"CURRENT");
  assert.equal(parentPasswordValidation("OldPass1!","OldPass1!","OldPass1!"),"SAME");
  assert.equal(parentPasswordValidation("OldPass1!","short","short"),"LENGTH");
  assert.equal(parentPasswordValidation("OldPass1!","NewPass2#","WrongPass2#"),"CONFIRM");
});
