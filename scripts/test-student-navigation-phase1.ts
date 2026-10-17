import assert from "node:assert/strict";
import test from "node:test";
import {studentTabOrder,studentDestination,studentTabForScreen,
  studentReturnScreen,studentIsPrimaryScreen} from "../apps/mobile/src/student-navigation-model.js";

test("Student Phase 1 always offers five unique ordered primary tabs",()=>{
  assert.deepEqual(studentTabOrder,["HOME","TIMETABLE","HOMEWORK","RESULTS","MORE"]);
  assert.equal(new Set(studentTabOrder).size,5);
});
test("Student Phase 1 round-trips each tab to its own route",()=>{
  for(const tab of studentTabOrder){
    const screen=studentDestination(tab);
    assert.equal(studentTabForScreen(screen),tab);
    assert.equal(studentReturnScreen(screen),screen);
    assert.equal(studentIsPrimaryScreen(screen),true);
  }
  assert.equal(studentDestination("TIMETABLE"),"student-timetable");
  assert.equal(studentTabForScreen("student-timetable"),"TIMETABLE");
});
test("Student Phase 1 child pages are not mistaken for bottom tabs",()=>{
  for(const screen of ["student-communication","teacher-attendance","login","role","student-fees",""]){
    assert.equal(studentTabForScreen(screen),null);
    assert.equal(studentIsPrimaryScreen(screen),false);
    assert.equal(studentReturnScreen(screen),"home");
  }
});
test("Student Phase 1 More and Home return destinations remain distinct",()=>{
  assert.equal(studentReturnScreen("student-more"),"student-more");
  assert.equal(studentReturnScreen("home"),"home");
  assert.equal(studentReturnScreen("student-homework"),"student-homework");
  assert.equal(studentReturnScreen("student-results"),"student-results");
});
