import assert from "node:assert/strict";
import test from "node:test";
import {
  validStoredStaffSession, verifiedStaffProfileIdentity,
  staffSessionMustExit, staffRequestIdentityCurrent
} from "../apps/web/app/staff/staff-session-policy.js";

const schoolId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherSchool = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const otherUser = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const now = Date.UTC(2026,10,13);
const good = () => ({
  school: {id:schoolId,code:"KBL-100",name:"Sample Academy",province:"Kabul",city:"Kabul",imageUrl:null},
  session: {
    user: {id:userId,schoolId,role:"SCHOOL_STAFF",status:"ACTIVE",username:"staff-demo",
      mustChangePassword:false},
    accessToken:"access-demo-hello",refreshToken:"refresh-demo-hello",
    accessExpiresAt:"2026-11-13T12:00:00.000Z",
    refreshExpiresAt:"2026-12-13T12:00:00.000Z",
    mustChangePassword:false
  }
});

test("Phase 16 16.1: accepts only structurally valid in-school active Staff sessions",()=>{
  const session=good();
  assert.equal(validStoredStaffSession(session,now),true);
  assert.equal(validStoredStaffSession(null,now),false);
  assert.equal(validStoredStaffSession([],now),false);
  assert.equal(validStoredStaffSession({...session,school:{...session.school,id:otherSchool}},now),false);
  assert.equal(validStoredStaffSession({...session,session:{...session.session,user:{
    ...session.session.user,schoolId:otherSchool
  }}},now),false);
  for(const role of ["SCHOOL_ADMIN","PARENT","TEACHER"]){
    assert.equal(validStoredStaffSession({...session,session:{...session.session,user:{
      ...session.session.user,role
    }}},now),false,role);
  }
  for(const status of ["SUSPENDED","ARCHIVED","INVITED"]){
    assert.equal(validStoredStaffSession({...session,session:{...session.session,user:{
      ...session.session.user,status
    }}},now),false,status);
  }
  assert.equal(validStoredStaffSession({...session,session:{...session.session,mustChangePassword:true}},now),false);
  assert.equal(validStoredStaffSession({...session,session:{...session.session,refreshExpiresAt:"2026-11-12T00:00:00.000Z"}},now),false);
  assert.equal(validStoredStaffSession({...session,session:{...session.session,accessExpiresAt:"broken"}},now),false);
  assert.equal(validStoredStaffSession({...session,session:{...session.session,accessToken:""}},now),false);
});

test("Phase 16 16.2: server /me identity must match persisted user and school",()=>{
  const stored=good();
  const profile={user:{id:userId,role:"SCHOOL_STAFF",status:"ACTIVE"},school:{id:schoolId}};
  assert.equal(verifiedStaffProfileIdentity(stored,profile),true);
  assert.equal(verifiedStaffProfileIdentity(stored,{...profile,user:{...profile.user,id:otherUser}}),false);
  assert.equal(verifiedStaffProfileIdentity(stored,{...profile,school:{id:otherSchool}}),false);
  assert.equal(verifiedStaffProfileIdentity(stored,{...profile,user:{...profile.user,status:"SUSPENDED"}}),false);
  assert.equal(verifiedStaffProfileIdentity(stored,{...profile,user:{...profile.user,role:"SCHOOL_ADMIN"}}),false);
  assert.equal(verifiedStaffProfileIdentity(stored,null),false);
});

test("Phase 16 16.3: network / 503 and permission denial preserve Staff login for retry",()=>{
  for(const failure of [null,new Error("network down"),{status:503,code:"school_service_unavailable"},
    {status:500,code:"internal_error"},{status:403,code:"permission_denied"},
    {status:401,code:"current_password_invalid"}]){
    assert.equal(staffSessionMustExit(failure,"/v1/auth/change-password"),false);
  }
  for(const failure of [{status:401,code:"session_invalid"},{status:401,code:"refresh_invalid"},
    {status:403,code:"account_suspended"}]){
    assert.equal(staffSessionMustExit(failure,"/v1/staff/me"),true);
  }
  assert.equal(staffSessionMustExit({status:401,code:"session_invalid"},"/v1/auth/refresh"),true);
  assert.equal(staffSessionMustExit({status:401,code:"current_password_invalid"},"/v1/staff/me"),true);
});

test("Phase 16 16.4: stale responses cannot cross logout or staff account changes",()=>{
  const current=good();
  assert.equal(staffRequestIdentityCurrent(1,1,userId,schoolId,current),true);
  assert.equal(staffRequestIdentityCurrent(1,2,userId,schoolId,current),false);
  assert.equal(staffRequestIdentityCurrent(1,1,otherUser,schoolId,current),false);
  assert.equal(staffRequestIdentityCurrent(1,1,userId,otherSchool,current),false);
  assert.equal(staffRequestIdentityCurrent(1,1,userId,schoolId,null),false);
});
