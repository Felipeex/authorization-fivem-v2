import { Router, Request, Response, NextFunction } from "express";
import { fetchServer } from "cfx-api";
import { createHash } from "crypto";
const router = Router();

interface AuthorizationProps {
  script: string;
  hwid: string;
  KeymasterId: string;
}

const bsPolice_ClientCode = `local Tunnel = module("vrp", "lib/Tunnel")
local Proxy = module("vrp","lib/Proxy")
VServer = {}
Tunnel.bindInterface("bsPolice", VServer)
Server = Tunnel.getInterface("bsPolice")
Police = Tunnel.getInterface("police")
vRP = Proxy.getInterface("vRP")
local promise = {}
local tabletState = false
local isArrest = false
local fineValue = false

RegisterCommand(Config.Command, function()
    VServer.Open()
end)

function VServer.Open()
    if (Config.Item ~= "") then
        if Server.GetInventoryItem(Server.GetUserId(), Config.Item) then
            Open()
        else
            Server.Notify(Config.NotHasItem)
        end
    else
        Open()
    end
end

function Open()
    if (Server.IsExistPermission()) then
        if not (Server.Alive()) then return Server.Notify(Config.NotAlive) end
        vRP.removeObjects()
		vRP.createObjects("amb@code_human_in_bus_passenger_idles@female@tablet@base","base","prop_cs_tablet",50,28422)
        ToogleTablet(true)
    else
        Server.Notify(Config.NotPermission)
    end
end

RegisterNetEvent("bsPolice:res:backend", function(promiseId, ...)
    if not promise[promiseId] then return end
    promise[promiseId](...)
    promise[promiseId] = nil
end)

local eventId = 1
RegisterNetEvent("bsPolice:res:event", function(event)
    if not (tabletState) then return end
    if not (type(event) == "table") then
        SendEvent(event)
        return
    end

    for _, singleEvent in pairs(event) do
        SendEvent(singleEvent)
    end
end)

function SendEvent(event)
    SendNUIMessage({ action = event, data = eventId })
    eventId = eventId + 1
end

RegisterNUICallback("bsPolice:backend", function(data, cb)
    if (data["action"] == "language") then
      return cb(Config.Languages[Config.Language])
    end

    local promiseId = #promise + 1
    promise[promiseId] = cb
    TriggerServerEvent("bsPolice:req:backend", promiseId, data.action, data.args)
end)

local takePhoto = false
RegisterNUICallback("close", function(_, cb)
    VServer.Close()
    cb(true)
end)

RegisterNetEvent("TabletClose", function()
    VServer.Close()
end)

function VServer.Close()
    takePhoto = false
    SetFollowPedCamViewMode(0)
    ToogleTablet(false)
    vRP.removeObjects()
end

SetFollowPedCamViewMode(0)

RegisterNUICallback("bsPolice:onPhoto", function(_, cb)
    SetNuiFocus(true, true)
    --[[ CreateMobilePhone(1)
    CellCamActivate(true, true) ]]
    SetFollowPedCamViewMode(4)
    takePhoto = true
    Wait(4)
    while takePhoto do
        Wait(100)
        HideHudComponentThisFrame(7)
        HideHudComponentThisFrame(8)
        HideHudComponentThisFrame(9)
        HideHudComponentThisFrame(6)
        HideHudComponentThisFrame(19)
        HideHudAndRadarThisFrame()
    end
    Wait(800)
    if (takePhoto) then cb(true) end
end)

CreateThread(function()
    while Config.PoliceInServiceState() do
        Wait(1000 * 60)
        Server.updateWorkTime()
    end
end)

function ToogleTablet(state)
    SendNUIMessage({ action = "tablet", data = state })
    SetNuiFocus(state, state)
    tabletState = state
end

local function GetPlayers()
    local pedList = {}

    for _, _player in ipairs(GetActivePlayers()) do
        pedList[GetPlayerServerId(_player)] = true
    end

    return pedList
end

function VServer.NearestPlayers(vDistance, source)
    local userList = {}
    local ped = PlayerPedId()
    local userPlayers = GetPlayers()
    local coords = GetEntityCoords(ped)

    for playerSource, _ in pairs(userPlayers) do
       --[[  if playerSource ~= source then ]]
            local uPed = GetPlayerPed(GetPlayerFromServerId(playerSource))
            local uCoords = GetEntityCoords(uPed)
            local distance = #(coords - uCoords)
            if distance <= vDistance then
                userList[playerSource] = playerSource
            end
        --[[ end ]]
    end

    return userList
end

function VServer.PlayersOn(source)
    local userList = {}
    local userPlayers = GetPlayers()

    for playerSource, _ in pairs(userPlayers) do
        --[[ if playerSource ~= source then ]]
            userList[playerSource] = playerSource
        --[[ end ]]
    end

    return userList
end

function VServer.PrisionPlayer(time, value)
    local Ped = GetPlayerPed(GetPlayerFromServerId(source))
    DoScreenFadeOut(500)
    Wait(400)
    SetEntityCoords(Ped, 1775.65,2552.06,45.56)
    SetEntityHeading(Ped, 85.04)
    Wait(500)
    Wait(1000)
    DoScreenFadeIn(1000)
    SendNUIMessage({ action = "prison", data = { time = time, value = value } })
    isArrest = true
    fineValue = value
end

function VServer.PrisionPolice(playerId, totalTime, totalFine, description)
    Police.initPrison(playerId, totalTime, totalFine, description)
end

CreateThread(function()
    while true do
        if (exports["police"]:checkPrison()) then
            if (fineValue) then
                SendNUIMessage({ action = "prison", data = { time = Server.GetPrison(), value = fineValue } })
            else
                SendNUIMessage({ action = "prison", data = { time = Server.GetPrison() } })
            end
        else
            if (isArrest) then
                isArrest = false
                fineValue = false
                SendNUIMessage({ action = "prison", data = false })
            end
        end
        Wait(500)
    end
end)`;

const bsPolice_ServerCode = `
local Frameworks = {
  ["CreativeV5"] = function()
    Prepare("getAllInfos", "SELECT * FROM summerz_characters WHERE id = @id")
    Prepare("allPlayers", "SELECT photo, name, name2, id FROM summerz_characters")
    Prepare("createPhoto", [[ALTER TABLE summerz_characters ADD IF NOT EXISTS (
      photo LONGTEXT
    )]])
    Prepare("updatePhoto", "UPDATE summerz_characters SET photo = @photo WHERE id = @id")
    Prepare("handlePort", "UPDATE summerz_characters SET port = NOT port WHERE id = @id")

    Prepare("createHistoric", [[CREATE TABLE IF NOT EXISTS bspolice_historic (
      user_id INT NOT NULL,
      police_id INT NOT NULL,
      type ENUM("Prisão", "Multa") NOT NULL,
      description VARCHAR(255) DEFAULT("Sem descrição"),
      value INT DEFAULT(0),
      createdAt VARCHAR(50),
      FOREIGN KEY (police_id) REFERENCES summerz_characters(id),
      FOREIGN KEY (user_id) REFERENCES summerz_characters(id)
    )]])
    Prepare("createWantedPeople", [[CREATE TABLE IF NOT EXISTS bspolice_wanted_people (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      description VARCHAR(255) DEFAULT("Sem descrição"),
      wantedAt VARCHAR(50),
      lastSeeAt VARCHAR(50),
      At VARCHAR(255),
      FOREIGN KEY (user_id) REFERENCES summerz_characters(id)
    )]])
    Prepare("createReportCard", [[CREATE TABLE IF NOT EXISTS bspolice_report_card (
      applicant_id INT NOT NULL,
      suspect_id INT NOT NULL,
      police_id INT NOT NULL,
      description VARCHAR(255) DEFAULT("Sem descrição"),
      createdAt VARCHAR(50),
      status BOOLEAN DEFAULT(true),
      FOREIGN KEY (applicant_id) REFERENCES summerz_characters(id),
      FOREIGN KEY (suspect_id) REFERENCES summerz_characters(id),
      FOREIGN KEY (police_id) REFERENCES summerz_characters(id)
    )]])
  end,

  ["BlackNetwork"] = function()
    Prepare("getAllInfos", "SELECT * FROM black_characters WHERE id = @id")
    Prepare("allPlayers", "SELECT photo, name, name2, id FROM black_characters")
    Prepare("createPhoto", [[ALTER TABLE black_characters ADD IF NOT EXISTS (
      photo LONGTEXT
    )]])
    Prepare("updatePhoto", "UPDATE black_characters SET photo = @photo WHERE id = @id")
    Prepare("handlePort", "UPDATE black_characters SET port = NOT port WHERE id = @id")

    Prepare("createHistoric", [[CREATE TABLE IF NOT EXISTS bspolice_historic (
      user_id INT NOT NULL,
      police_id INT NOT NULL,
      type ENUM("Prisão", "Multa") NOT NULL,
      description VARCHAR(255) DEFAULT("Sem descrição"),
      value INT DEFAULT(0),
      createdAt VARCHAR(50),
      FOREIGN KEY (police_id) REFERENCES black_characters(id),
      FOREIGN KEY (user_id) REFERENCES black_characters(id)
    )]])
    Prepare("createWantedPeople", [[CREATE TABLE IF NOT EXISTS bspolice_wanted_people (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      user_id INT NOT NULL,
      description VARCHAR(255) DEFAULT("Sem descrição"),
      wantedAt VARCHAR(50),
      lastSeeAt VARCHAR(50),
      At VARCHAR(255),
      FOREIGN KEY (user_id) REFERENCES black_characters(id)
    )]])
    Prepare("createReportCard", [[CREATE TABLE IF NOT EXISTS bspolice_report_card (
      id INT AUTO_INCREMENT PRIMARY KEY,
      applicant_id INT NOT NULL,
      suspect_id INT NOT NULL,
      police_id INT NOT NULL,
      description VARCHAR(255) DEFAULT("Sem descrição"),
      createdAt VARCHAR(50),
      status BOOLEAN DEFAULT(true),
      FOREIGN KEY (applicant_id) REFERENCES black_characters(id),
      FOREIGN KEY (suspect_id) REFERENCES black_characters(id),
      FOREIGN KEY (police_id) REFERENCES black_characters(id)
    )]])
  end,

  ["yourFramework"] = function()
    Prepare("exemple", "SELECT name, name2, id FROM your_characters_table")
  end,

  ["Generic"] = function() --[[ Tabelas genéricas ]]
    Prepare("createStatistics", [[CREATE TABLE IF NOT EXISTS bspolice_statistics (
      type VARCHAR(50),
      value int(50),
      createdAt VARCHAR(50)
    )]])
    Prepare("createWarns", [[CREATE TABLE IF NOT EXISTS bspolice_warns (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      title VARCHAR(255),
      description LONGTEXT,
      createdAt VARCHAR(50)
    )]])
    Prepare("createMembers", [[CREATE TABLE IF NOT EXISTS bspolice_members (
      id INT PRIMARY KEY,
      name VARCHAR(255),
      patent VARCHAR(50),
      ago VARCHAR(50),
      arrests INT DEFAULT(0),
      fines INT DEFAULT(0),
      reportCards INT DEFAULT(0),
      seizedVehicles INT DEFAULT(0),
      totalWorkTime FLOAT DEFAULT(0),
      totalInFines INT DEFAULT(0),
      createdAt VARCHAR(50)
    )]])
    Prepare("createWantedVehicle", [[CREATE TABLE IF NOT EXISTS bspolice_wanted_vehicle (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      model VARCHAR(255) NOT NULL,
      description VARCHAR(255) DEFAULT("Sem descrição"),
      wantedAt VARCHAR(50),
      lastSeeAt VARCHAR(50),
      At VARCHAR(255)
    )]])

    Prepare("getMembers", "SELECT * FROM bspolice_members")
    Prepare("findMember", "SELECT * FROM bspolice_members WHERE id = @id")
    Prepare("searchIdByName", "SELECT id FROM bspolice_members WHERE name = @name")
    Prepare("PlusArrest", "UPDATE bspolice_members SET arrests = arrests + 1 WHERE name = @name")
    Prepare("PlusFine", "UPDATE bspolice_members SET fines = fines + 1 WHERE name = @name")
    Prepare("createMember", "INSERT INTO bspolice_members(id, name, patent, ago, createdAt) VALUES (@id, @name, @patent, @ago, @createdAt)")
    Prepare("updateMember", "UPDATE bspolice_members SET name = @name, patent = @patent, ago = @ago WHERE id = @id")
    Prepare("getWorkTime", "SELECT totalWorkTime FROM bspolice_members WHERE id = @id")
    Prepare("updateWorkTime", "UPDATE bspolice_members SET totalWorkTime = @totalWorkTime WHERE id = @id")
    Prepare("deleteMember", "DELETE FROM bspolice_members WHERE id = @id")

    Prepare("createWarn", "INSERT INTO bspolice_warns(title, description, createdAt) VALUES (@title, @description, @createdAt)")
    Prepare("getWarns", "SELECT * FROM bspolice_warns")
    Prepare("editWarn", "UPDATE bspolice_warns SET title = @title, description = @description WHERE id = @id")
    Prepare("deleteWarn", "DELETE FROM bspolice_warns WHERE id = @id")

    Prepare("createStatistic", "INSERT INTO bspolice_statistics(type, createdAt, value) VALUES (@type,@createdAt,@value)")
    Prepare("getStatistics", "SELECT * FROM bspolice_statistics")
    Prepare("updateStatistic", "UPDATE bspolice_statistics SET value = value + 1 WHERE createdAt = @createdAt AND type = @type")
    Prepare("existStatistic", "SELECT * FROM bspolice_statistics WHERE type = @type")

    Prepare("findHistoricsByUser", "SELECT * FROM bspolice_historic WHERE user_id = @user_id")
    Prepare("findHistoricsByPolice", "SELECT * FROM bspolice_historic WHERE police_id = @police_id")
    Prepare("insertHistoric", "INSERT INTO bspolice_historic(user_id, police_id, type, description, value, createdAt) VALUES (@user_id, @police_id, @type, @description, @value, @createdAt)")
    Prepare("deleteHistoric", "DELETE FROM bspolice_historic WHERE user_id = @user_id AND createdAt = @createdAt")

    Prepare("getAllWantedPerson", "SELECT * FROM bspolice_wanted_people")
    Prepare("updateWantedPerson", "UPDATE bspolice_wanted_people SET user_id = @user_id, description = @description, lastSeeAt = @lastSeeAt, At = @At WHERE id = @id")
    Prepare("insertWantedPerson", "INSERT INTO bspolice_wanted_people(user_id, description, wantedAt, lastSeeAt, At) VALUES (@user_id, @description, @wantedAt, @lastSeeAt, @At)")
    Prepare("deleteWantedPerson", "DELETE FROM bspolice_wanted_people WHERE id = @id")

    Prepare("getAllWantedVehicle", "SELECT * FROM bspolice_wanted_vehicle")
    Prepare("updateWantedVehicle", "UPDATE bspolice_wanted_vehicle SET model = @model, description = @description, lastSeeAt = @lastSeeAt, At = @At WHERE id = @id")
    Prepare("insertWantedVehicle", "INSERT INTO bspolice_wanted_vehicle(model, description, wantedAt, lastSeeAt, At) VALUES (@model, @description, @wantedAt, @lastSeeAt, @At)")
    Prepare("deleteWantedVehicle", "DELETE FROM bspolice_wanted_vehicle WHERE id = @id")

    Prepare("getAllReportCards", "SELECT * FROM bspolice_report_card")
    Prepare("insertReportCard", "INSERT INTO bspolice_report_card(applicant_id, suspect_id, police_id, description, createdAt) VALUES (@applicantId, @suspectId, @policeId, @description, @createdAt)")
    Prepare("updateReportCard", "UPDATE bspolice_report_card SET applicant_id = @applicantId, suspect_id = @suspectId, police_id = @policeId, description = @description WHERE id = @id")
    Prepare("handleChangeReportCardStatus", "UPDATE bspolice_report_card SET status = NOT status WHERE id = @id")
    Prepare("deleteReportCard", "DELETE FROM bspolice_report_card WHERE id = @id")

    CreateThread(function()
      Execute("createStatistics")
      Execute("createMembers")
      Execute("createWarns")
      Execute("createPhoto")
      Execute("createHistoric")
      Execute("createWantedPeople")
      Execute("createWantedVehicle")
      Execute("createReportCard")
    end)
  end
}

FrameworksFunctions = {
  ["CreativeV5"] = function()
    Execute = vRP.execute
    Query = vRP.query
    Prepare = vRP.prepare
    GetUserId = vRP.getUserId
    GetSourceById = vRP.userSource
    HasGroup = vRP.hasGroup
    RemGroup = vRP.remPermission
    AddGroup = vRP.setPermission
    VehicleGlobal = vehicleGlobal
    Request = vRP.request
    AddFine = vRP.addFines
    GetInventoryItemAmount = function(...)
      if (vRP.getInventoryItemAmount(...)[2] ~= "") then
        return true
      end
      return false
    end
  end,

  ["BlackNetwork"] = function()
    Execute = vRP.execute
    Query = vRP.query
    Prepare = vRP.prepare
    GetUserId = vRP.getUserId
    GetSourceById = vRP.userSource
    HasGroup = vRP.hasGroup
    RemGroup = vRP.remPermission
    AddGroup = vRP.setPermission
    VehicleGlobal = vehicleGlobal
    Request = vRP.request
    AddFine = vRP.addFines
    GetInventoryItemAmount = function(...)
      if (vRP.getInventoryItemAmount(...)[2] ~= "") then
        return true
      end
      return false
    end
  end,

  ["yourFramework"] = function()
    Exemple_getUserId = function(source)
      return source * 10
    end
  end,
}

CreateThread(function()
  if Frameworks[Config.Framework] then
    FrameworksFunctions[Config.Framework]()
    Frameworks[Config.Framework]()
    Frameworks["Generic"]()
    print("Sua Framework foi reconhecida, " .. Config.Framework)
  else
    print("Sua Framework não foi reconhecida.")
  end
end)

local Proxy = module("vrp", "lib/Proxy")
local Tunnel = module("vrp", "lib/Tunnel")
vRP = Proxy.getInterface("vRP")

Client = {}
Tunnel.bindInterface("bsPolice", Client)
VClient = Tunnel.getInterface("bsPolice")

local function GetValuePerHistoricType(type, value)
  if (type == "Prisão") then
    return value .. " Meses"
  end

  if (type == "Multa") then
    return "R$" .. value
  end
end

local function ClearAllPermissionOfPolice(id)
  for _, position in pairs(Config.OrdersOfPositions) do
    if (HasGroup(id, position)) then
      RemGroup(id, position)
      RemGroup(id, Config.DefautGroup)
    end
  end
end


local function GetPositionPerOrder(position)
  for i = 1, #Config.OrdersOfPositions, 1 do
    local positionOfOrder = Config.OrdersOfPositions[i]
    if (positionOfOrder == position) then
      return i
    end
  end
end

local function GetFirstAndLastPosition()
  return Config.Positions[Config.OrdersOfPositions[1]],
      Config.Positions[Config.OrdersOfPositions[#Config.OrdersOfPositions]]
end

local function GetPositionPerTitle(title)
  for key, position in pairs(Config.Positions) do
    if (string.lower(position["title"]) == string.lower(title)) then
      return key
    end
  end

  return false
end

local function SetPosition(id, position, oldPostion)
  local member = Execute("findMember", { id = id })[1]
  Manager.updateMember(id, member["name"], position, false)

  AddGroup(id, GetPositionPerTitle(position))
  AddGroup(id, Config.DefautGroup)

  if (oldPostion) then
    RemGroup(id, oldPostion)
  end
end

local function InvertTable(table)
  local tableInverted = {}
  local tableSize = #table

  for i = tableSize, 1, -1 do
    tableInverted[tableSize - i + 1] = table[i]
  end

  return tableInverted
end

local function GetPlayerForSearch(player)
  return { passport = player["id"], name = "" .. player["name"] .. " " .. player["name2"] .. "", photo = player["photo"] }
end

local function invertTable(Table)
  local newTable = {}
  for i = #Table, 1, -1 do
    table.insert(newTable, Table[i])
  end
  return newTable
end

local function GetVehicleNameByModel(Model)
  local allVehicles = VehicleGlobal()

  for model, vehicle in pairs(allVehicles) do
    if (model == Model) then
      return vehicle[1]
    end
  end

  return "Desconhecido"
end

local function ConvertTimestamp(timestamp)
  local converted = timestamp / 1000
  return converted
end

local function VerifyWantedType(Type, Person, Vehicle)
  if (Type == "Person") then
    Person()
  else
    Vehicle()
  end
end

local function GetCurrentDate(date)
  date = os.date("*t", date)
  if not date then
    date = os.date("*t")
  end
  local year = tostring(date.year)
  local month = tostring(date.month)
  if #month == 1 then
    month = "0" .. month
  end
  local day = tostring(date.day)
  if #day == 1 then
    day = "0" .. day
  end
  local hours = tostring(date.hour)
  if #hours == 1 then
    hours = "0" .. hours
  end
  local minutes = tostring(date.min)
  if #minutes == 1 then
    minutes = "0" .. minutes
  end
  local seconds = tostring(date.sec)
  if #seconds == 1 then
    seconds = "0" .. seconds
  end
  return year .. "-" .. month .. "-" .. day .. "T" .. hours .. ":" .. minutes .. ":" .. seconds .. "Z"
end

ReportCard = {
  getReportCards = function()
    local getReportCards = Execute("getAllReportCards")
    local ReportCards = {}

    for _, card in pairs(getReportCards) do
      local applicant = Player.getAllInfos(card["applicant_id"])
      local suspect = Player.getAllInfos(card["suspect_id"])
      local police = Player.getAllInfos(card["police_id"])
      table.insert(ReportCards,
        {
          id = card["id"],
          description = card["description"],
          police = police["name"],
          date = GetCurrentDate(card["createdAt"]),
          status = card["status"],
          suspect = { id = card["suspect_id"], name = ""..card["suspect_id"].. " - "..suspect["name"] },
          applicant = { id = card["applicant_id"], name = ""..card["applicant_id"].. " - "..applicant["name"] }
        })
    end

    return ReportCards
  end,
  createReportCard = function(applicantId, suspectId, policeId, description)
    if (description == "") then description = "Sem Descrição" end
    Execute("insertReportCard",
      { applicantId = applicantId, suspectId = suspectId, policeId = policeId, description = description,
        createdAt = os.time() + (Config.PlusHours * 3600) })
    return true
  end,
  editReportCard = function (id, applicantId, suspectId, policeId, description)
    Execute("updateReportCard", { id = id, applicantId = applicantId, suspectId = suspectId, policeId = policeId, description = description })
    return true
  end,
  deleteReportCard = function(id)
    Execute("deleteReportCard", { id = id })
    return true
  end,
  handleChangeStatus = function(id)
    Execute("handleChangeReportCardStatus", { id = id })
    return true
  end
}

Wanted = {
  getWanteds = function()
    local getPeople = Execute("getAllWantedPerson")
    local getVehicles = Execute("getAllWantedVehicle")
    local WantedPeople = {}
    local WantedVehicle = {}

    for _, wantedPerson in pairs(getPeople) do
      local player = Player.getAllInfos(wantedPerson["user_id"])
      if (wantedPerson["description"] == "") then wantedPerson["description"] = "Sem descrição" end
      table.insert(WantedPeople,
        {
          updateId = wantedPerson["id"],
          id = wantedPerson["user_id"],
          type = "Person",
          name = player["name"],
          description = wantedPerson["description"],
          wantedAt = GetCurrentDate(wantedPerson["wantedAt"]),
          At = wantedPerson["At"],
          lastSeeAt = GetCurrentDate(wantedPerson["lastSeeAt"]),
          img = player["photo"]
        })
    end

    for _, wantedVehicle in pairs(getVehicles) do
      local vehicleName = GetVehicleNameByModel(wantedVehicle["model"])
      if (wantedVehicle["description"] == "") then wantedVehicle["description"] = "Sem descrição" end
      table.insert(WantedVehicle,
        {
          updateId = wantedVehicle["id"],
          id = wantedVehicle["model"],
          type = "Vehicle",
          name = vehicleName,
          description = wantedVehicle["description"],
          wantedAt = GetCurrentDate(wantedVehicle["wantedAt"]),
          At = wantedVehicle["At"],
          lastSeeAt = GetCurrentDate(wantedVehicle["lastSeeAt"])
        })
    end

    return {
      people = invertTable(WantedPeople),
      vehicles = invertTable(WantedVehicle)
    }
  end,
  createWanted = function(indentification, typ, description, lastSeeAt, At)
    VerifyWantedType(typ,
    function()
       Execute("insertWantedPerson",
        {
          user_id = indentification,
          description = description,
          wantedAt = os.time() + (Config.PlusHours * 3600),
          lastSeeAt = ConvertTimestamp(lastSeeAt) + (Config.PlusHours * 3600),
          At = At
        })
    end,
    function()
      Execute("insertWantedVehicle",
        {
          model = indentification,
          description = description,
          wantedAt = os.time() + (Config.PlusHours * 3600),
          lastSeeAt = ConvertTimestamp(lastSeeAt) + (Config.PlusHours * 3600),
          At = At
        })
    end)
    return true
  end,
  updateWanted = function(updateId, indentification, typ, description, lastSeeAt, At)
    VerifyWantedType(typ,
      function()
        Execute("updateWantedPerson",
          {
            id = updateId,
            user_id = indentification,
            description = description,
            lastSeeAt = ConvertTimestamp(lastSeeAt) + (Config.PlusHours * 3600),
            At = At
          })
      end,
      function()
        Execute("updateWantedVehicle",
          {
            id = updateId,
            model = indentification,
            description = description,
            lastSeeAt = ConvertTimestamp(lastSeeAt) + (Config.PlusHours * 3600),
            At = At
          })
      end)
      return true
  end,
  deleteWanted = function(typ, wanted_id)
    VerifyWantedType(typ,
      function()
        Execute("deleteWantedPerson", { id = wanted_id })
      end,
      function()
        Execute("deleteWantedVehicle", { id = wanted_id })
      end)
    return true
  end
}

Manager = {
  getMembers = function()
    local id = GetUserId(source)
    local getMembers = Query("getMembers")
    local members = {}

    for i = 1, #getMembers, 1 do
      local member = getMembers[i]
      local firstPatent, lastPatent = GetFirstAndLastPosition()
      table.insert(members,
        {
          id = member["id"],
          name = member["name"],
          patent = member["patent"],
          ago = GetCurrentDate(member["ago"]),
          isMe = id == member["id"],
          isOwner = Config.Positions[GetPositionPerTitle(member["patent"])].isOwner or false,
          firstPatent = Config.Positions[GetPositionPerTitle(member["patent"])] == firstPatent,
          lastPatent = Config.Positions[GetPositionPerTitle(member["patent"])] == lastPatent,
        })
    end

    return members
  end,
  getMember = function(id)
    local member = Player.getAllInfos(id)
    local findMember = Execute("findMember", { id = id })[1]

    return {
      name = member["name"],
      passport = member["passport"],
      port = member["port"],
      serial = member["serial"],
      photo = member["photo"],
      createdAt = GetCurrentDate(findMember["createdAt"]),
      patent = findMember["patent"],
      statistics = {
        arrests = findMember["arrests"],
        fines = findMember["fines"],
        reportCards = findMember["reportCards"],
        seizedVehicles = findMember["seizedVehicles"],
        totalWorkTime = string.gsub(findMember["totalWorkTime"], "%.", ":"),
        totalInFines = findMember["totalInFines"],
      }
    }
  end,
  createMember = function(id, name, patent)
    local existMember = Execute("findMember", { id = id })[1]

    if not (existMember) then
      Execute("createMember",
        { id = id, name = name, patent = patent, ago = os.time() + (Config.PlusHours * 3600),
          createdAt = os.time() + (Config.PlusHours * 3600) })
      return "Success"
    end

    return false
  end,
  updateMember = function(id, name, patent, isUpdateAgo)
    if (isUpdateAgo or isUpdateAgo == nil) then
      Execute("updateMember", { id = id, name = name, patent = patent, ago = os.time() + (Config.PlusHours * 3600) })
    else
      local oldAgo = Execute("findMember", { id = id })[1]["ago"]
      Execute("updateMember", { id = id, name = name, patent = patent, ago = oldAgo })
    end
  end,
  downgradeMember = function(id)
    local member = Execute("findMember", { id = id })[1]
    if (member) then
      local position = GetPositionPerTitle(member["patent"])
      local _, lastPostion = GetFirstAndLastPosition()

      if not (Config.Positions[position] == lastPostion) then
        local positionOfOrder = GetPositionPerOrder(position)
        local newPosition = Config.OrdersOfPositions[positionOfOrder + 1]
        SetPosition(id, Config.Positions[newPosition].title, position)

        return true
      end

      return false
    end
  end,
  promoteMember = function(id)
    local member = Execute("findMember", { id = id })[1]
    if (member) then
      local position = GetPositionPerTitle(member["patent"])
      local fistPosition = GetFirstAndLastPosition()

      if not (Config.Positions[position] == fistPosition) then
        local positionOfOrder = GetPositionPerOrder(position)
        local newPosition = Config.OrdersOfPositions[positionOfOrder - 1]
        SetPosition(id, Config.Positions[newPosition].title, position)

        return true
      end

      return false
    end
  end,
  dismissMember = function(id, source)
    local member = Execute("findMember", { id = id })[1]

    if (member) then
      local position = GetPositionPerTitle(member["patent"])

      if (position) then
        Execute("deleteMember", { id = id })

        if (source) then
          Manager.Notify(source, Config.dismissMember)
        end

        ClearAllPermissionOfPolice(id)
        return true
      end

      return false
    end
  end,
  Notify = function(source, notify)
    TriggerClientEvent(Config.NotifyEvent, source, table.unpack(notify))
  end,
  Plus = {
    Arrest = function(name)
      Execute("PlusArrest", { name = name })
    end,
    Fine = function(name)
      Execute("PlusFine", { name = name })
    end
  },
  searchIdByName = function(name)
    return Execute("searchIdByName", { name = name })[1]["id"]
  end,
  contractMember = function(id, position)
    if (Request(GetSourceById(id), Config.ContractMemberMessage:gsub("$position", Config.Positions[position].title))) then
      AddGroup(id, position)
      AddGroup(id, Config.DefautGroup)
      Manager.EnterPermissions(id)
      return true, "updateMembers"
    else
      return "Pedido recusado."
    end
  end,
  EnterPermissions = function(id)
    for _, position in pairs(Config.OrdersOfPositions) do
      if (HasGroup(id, position)) then
        local playerId, name, title = id, Player.getAllInfos(id)["name"], Config.Positions[position]["title"]

        if not (Manager.createMember(playerId, name, title)) then
          Manager.updateMember(playerId, name, title)
        end

        return Config.Positions[position], "updateMembers"
      end
    end
  end
}

Player = {
  getAllInfos = function(id, withHistoric)
    if not (id) then return end
    local player = Execute("getAllInfos", { id = id })[1]
    local getHistorics = Execute("findHistoricsByUser", { user_id = id })
    local historics = {}

    if (withHistoric) then
      for _, historic in pairs(getHistorics) do
        local police = Player.getAllInfos(historic["police_id"])
        table.insert(historics,
          {
            type = historic["type"],
            police = police["name"],
            date = GetCurrentDate(historic["createdAt"]),
            description = historic["description"],
            value = GetValuePerHistoricType(historic["type"], historic["value"]),
            createdAt = historic["createdAt"]
          })
      end
    end

    return {
      passport = player["id"],
      name = GetPlayerForSearch(player)["name"],
      age = player["age"],
      port = player["port"],
      serial = player["serial"],
      photo = player["photo"],
      prison = player["prison"],
      historic = invertTable(historics),
    }
  end,
  updatePhoto = function(id, photo)
    Execute("updatePhoto", { id = id, photo = photo })
    return "Success"
  end,
  AllPlayers = {
    Nearest = function()
      local getPlayers = VClient.NearestPlayers(source, Config.SearchPlayerDistace, source)
      local allPlayers = {}

      for source, _ in pairs(getPlayers) do
        local id = GetUserId(source)

        --[[ if not (Player.IsPolice(id)) then ]]
        local playerInfos = Player.getAllInfos(id)
        table.insert(allPlayers, { id = id, name = "#" .. id .. " - " .. playerInfos["name"] .. "" })
        --[[ end ]]
      end

      return allPlayers
    end,
    On = function()
      local getPlayers = VClient.PlayersOn(source, source)
      local allPlayers = {}

      for source, _ in pairs(getPlayers) do
        local id = GetUserId(source)

        --[[ if not (Player.IsPolice(id)) then ]]
        local playerInfos = Player.getAllInfos(id)
        table.insert(allPlayers, { id = id, name = "#" .. id .. " - " .. playerInfos["name"] .. "" })
        --[[ end ]]
      end

      return allPlayers
    end
  },
  IsPolice = function(id)
    for _, position in pairs(Config.OrdersOfPositions) do
      if (HasGroup(id, position)) then
        return true
      end
    end

    return false
  end,
  insertHistoric = function(user_id, police_id, typ, description, value, createdAt)
    return Execute("insertHistoric",
      {
        user_id = user_id,
        police_id = police_id,
        type = typ,
        description = description,
        value = value,
        createdAt = os.time() + (Config.PlusHours * 3600)
      })
  end,
  deleteHistoric = function(user_id, createdAt)
    Execute("deleteHistoric", { user_id = user_id, createdAt = createdAt })
    return true
  end,
  handlePort = function(id)
    Execute("handlePort", { id = id })
    return true
  end
}

Warns = {
  CreateWarn = function(title, description)
    Execute("createWarn", { title = title, description = description, createdAt = os.time() + (Config.PlusHours * 3600) })
    return "Success"
  end,
  getWarns = function()
    local getWarns = Query("getWarns")
    local warns = {}

    for _, warn in pairs(getWarns) do
      table.insert(warns,
        {
          id = warn["id"],
          title = warn["title"],
          description = warn["description"],
          createdAt = GetCurrentDate(warn["createdAt"])
        })
    end

    return InvertTable(warns)
  end,
  editWarn = function(id, title, description)
    Execute("editWarn", { id = id, title = title, description = description })
    return "Success"
  end,
  deleteWarn = function(id)
    Execute("deleteWarn", { id = id })
    return "Success"
  end
}

Statistics = {
  GetStatistics = function()
    local getStatistics = Query("getStatistics")
    local statistics = {}

    for _, getStatistic in pairs(getStatistics) do
      local year, month, day = Statistics.GetStatisticDate(GetCurrentDate(getStatistic["createdAt"]))
      local date = year .. month .. day

      if not statistics[date] then
        statistics[date] = {
          date = GetCurrentDate(getStatistic["createdAt"]),
          data = {}
        }
      end

      table.insert(statistics[date]["data"], { name = getStatistic["type"], Valor = getStatistic["value"] })
    end

    local statisticsReturn = {}

    for _, statistic in pairs(statistics) do
      table.insert(statisticsReturn, statistic)
    end

    return statisticsReturn
  end,
  GetStatisticDate = function(createdAt)
    return createdAt:match("(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)Z")
  end,
  CreateStatistic = function(typ)
    local today = os.time() + (Config.PlusHours * 3600)
    local existStatisticType = Execute("existStatistic", { type = typ })

    if (#existStatisticType <= 0) then
      Execute("createStatistic", { type = typ, createdAt = today, value = 1 })
      return
    end

    for _, statistic in pairs(existStatisticType) do
      local statisticDate = os.date("*t", statistic["createdAt"])
      local todayDate = os.date("*t", today)

      if (Statistics.VerifyDateIsSameDay(statisticDate, todayDate)) then
        Execute("updateStatistic", { type = typ, createdAt = statistic["createdAt"] })
        return
      end
    end

    Execute("createStatistic", { type = typ, createdAt = today, value = 1 })
  end,

  VerifyDateIsSameDay = function(firstDate, secondaryDate)
    if firstDate["day"] == secondaryDate["day"] and
        firstDate["month"] == secondaryDate["month"] and
        firstDate["year"] == secondaryDate["year"] then
      return true
    else
      return false
    end
  end
}

function GetInfosPerName(name)
  local finded = Query("allPlayers")
  local possiblePlayers = {}
  for _, player in ipairs(finded) do
    if (string.find(string.lower(tostring(GetPlayerForSearch(player)["name"])), tostring(name))) then
      table.insert(possiblePlayers, GetPlayerForSearch(player))
    end
  end
  return possiblePlayers
end

function GetInfosPerId(id)
  local finded = Query("allPlayers")
  local possiblePlayers = {}
  for _, player in ipairs(finded) do
    if (string.find(tostring(player["id"]), tostring(id))) then
      table.insert(possiblePlayers, GetPlayerForSearch(player))
    end
  end
  return possiblePlayers
end

function Client.Notify(...)
  TriggerClientEvent(Config.NotifyEvent, source, table.unpack(...))
end

function Client.IsExistPermission()
  local source = source
  local userId <const> = GetUserId(source)
  for key, _ in pairs(Config.Positions) do
    if (HasGroup(userId, key)) then return true end
  end
end

function Client.updateWorkTime()
  while not GetUserId do
    Wait(1)
  end
  local id = GetUserId(source)
  local getWorkTime = Execute("getWorkTime", { id = id })[1]
  local totalWorkTime = 0

  if (getWorkTime) then
    totalWorkTime = getWorkTime["totalWorkTime"]
  end

  local fullNumber = math.modf(totalWorkTime)
  local decimal = totalWorkTime - fullNumber
  local finalNumber = 0

  if (decimal >= 0.60) then
    finalNumber = fullNumber + 1
  else
    finalNumber = totalWorkTime + 0.01
  end

  Execute("updateWorkTime", { id = id, totalWorkTime = finalNumber })
end

function Client.Alive()
  local source = source
  if not (vRP.getHealth(source) <= 101) then
    return true
  end

  return false
end

function Client.GetInventoryItem(...)
  return GetInventoryItemAmount(...)
end

function Client.GetUserId()
  return GetUserId(source)
end

function Client.GetPrison()
  while not GetUserId do
    Wait(1)
  end

  local id = GetUserId(source)
  local player = Player.getAllInfos(id, false)
  if (player) then
    return player["prison"]
  end
end

PrisionPlayer = VClient.PrisionPlayer
PrisionPolice = VClient.PrisionPolice

Methods = {
  permissions = function()
    while not GetUserId do
      Wait(1)
    end

    local id = GetUserId(source)
    return Manager.EnterPermissions(id)
  end,
  oficialName = function()
    local id = GetUserId(source)
    return Player.getAllInfos(id)["name"]
  end,
  dismissMember = function(data)
    local id = data["id"]
    local dismiss = Manager.dismissMember(id, GetSourceById(id))

    if (dismiss and GetSourceById(id)) then
      TriggerClientEvent("TabletClose", GetSourceById(id))
    end

    return dismiss, { "updateMembers", "VerifyIsHavingPermission" }
  end,
  promoteMember = function(data)
    local id = data["id"]
    return Manager.promoteMember(id), { "updateMembers", "updatePermission" }
  end,
  downgradeMember = function(data)
    local id = data["id"]
    return Manager.downgradeMember(id), { "updateMembers", "updatePermission" }
  end,
  getMembers = function()
    return Manager.getMembers()
  end,
  getMember = function(data)
    local id = data["id"]
    return Manager.getMember(id)
  end,
  createWarn = function(data)
    local title = data["title"]
    local description = data["description"]

    return Warns.CreateWarn(title, description), "updateWarns"
  end,
  editWarn = function(data)
    local id = data["id"]
    local title = data["title"]
    local description = data["description"]

    return Warns.editWarn(id, title, description), "updateWarns"
  end,
  deleteWarn = function(data)
    local id = data["id"]
    return Warns.deleteWarn(id), "updateWarns"
  end,
  warns = function()
    return Warns.getWarns()
  end,
  statistics = function()
    return Statistics.GetStatistics()
  end,
  updatePhoto = function(data)
    local id = data["id"]
    local photo = data["photo"]

    return Player.updatePhoto(id, photo), "updatePlayers"
  end,
  players = function(data)
    local listPossiblePlayers = {}
    local possiblePassport = data["possiblePassport"]
    local possibleNames = data["possibleNames"]

    if (possiblePassport) then
      for _, id in ipairs(possiblePassport) do
        table.insert(listPossiblePlayers, GetInfosPerId(tonumber(id)))
      end
    end

    if (possibleNames) then
      for _, name in ipairs(possibleNames) do
        table.insert(listPossiblePlayers, GetInfosPerName(tostring(name)))
      end
    end

    return listPossiblePlayers[1]
  end,
  player = function(data)
    local id = data["id"]
    return Player.getAllInfos(id, true)
  end,
  playersOnNearest = function()
    return Player.AllPlayers.Nearest()
  end,
  playersOn = function()
    return Player.AllPlayers.On()
  end,
  allVehicles = function()
    local allVehicles = VehicleGlobal()
    local vehicles = {}

    for model, vehicle in pairs(allVehicles) do
      table.insert(vehicles, { model = model, name = vehicle[1] })
    end

    return vehicles
  end,
  allPositions = function()
    local allPositions = {}
    for _, position in pairs(Config.OrdersOfPositions) do
      table.insert(allPositions, { name = position })
    end
    return allPositions
  end,
  ArticlesOfArrest = function()
    return Config.Articles["arrest"]
  end,
  ArticlesOfFine = function()
    return Config.Articles["fines"]
  end,
  wanteds = function()
    return Wanted.getWanteds()
  end,
  language = function()
    return Config.Languages[Config.Language]
  end,
  prison = function(data)
    local player = data["player"]
    local oficialName = data["oficialName"]
    local description = data["description"]
    local infringements = data["infringement"]
    local oficialId = Manager.searchIdByName(oficialName)
    local articles = ""
    local totalTime = 0
    local totalFine = 0

    for _, infringement in pairs(infringements) do
      if (infringement["numberOfArticle"]) then
        if (articles == "") then
          articles = infringement["numberOfArticle"]
        else
          articles = articles..", "..infringement["numberOfArticle"]
        end
      end

      if (infringement["timeOfPrision"]) then
        totalTime = totalTime + infringement["timeOfPrision"]
      end

      if (infringement["fineOfPrision"]) then
        totalFine = totalFine + infringement["fineOfPrision"]
      end
    end

    if (description == "") then
      description = articles
    else
      description = articles.. " - " ..description
    end

    --[[ TriggerClientEvent("TabletClose", GetSourceById(oficialId)) ]]

    Player.insertHistoric(player["id"], oficialId, "Prisão", description, totalTime)
    Manager.Plus.Arrest(oficialName)
    Statistics.CreateStatistic(Config.Languages[Config.Language]["arrestsMade"])

    PrisionPlayer(GetSourceById(player["id"]), totalTime, totalFine)
    PrisionPolice(GetSourceById(oficialId), player["id"], totalTime, totalFine, description)
    return true
  end,
  fine = function(data)
    local player = data["player"]
    local oficialName = data["oficialName"]
    local description = data["description"]
    local infringements = data["infringement"]
    local oficialId = Manager.searchIdByName(oficialName)
    local totalFine = 0

    for _, infringement in pairs(infringements) do
      if (infringement["fineValue"]) then
        totalFine = totalFine + infringement["fineValue"]
      end
    end

    --[[ TriggerClientEvent("TabletClose", GetSourceById(oficialId)) ]]

    if (description == "") then
      description = "Sem descrição"
    end

    Player.insertHistoric(player["id"], oficialId, "Multa", description, totalFine)
    Manager.Plus.Fine(oficialName)
    Statistics.CreateStatistic(Config.Languages[Config.Language]["finesApplied"])

		AddFine(player["id"], totalFine)
    return true
  end,
  deleteHistoric = function(data)
    local id = data["id"]
    local createdAt = data["createdAt"]
    return Player.deleteHistoric(id, createdAt), "updatePlayers"
  end,
  createWanted = function(data)
    local identification = data["id"]
    local typ = data["type"]
    local description = data["description"]
    local lastSeeAt = data["lastSeeAt"]
    local At = data["At"]

    return Wanted.createWanted(identification, typ, description, lastSeeAt, At), "updateWanted"
  end,
  updateWanted = function(data)
    local updateId = data["updateId"]
    local identification = data["id"]
    local typ = data["type"]
    local description = data["description"]
    local lastSeeAt = data["lastSeeAt"]
    local At = data["At"]

    return Wanted.updateWanted(updateId, identification, typ, description, lastSeeAt, At), "updateWanted"
  end,
  deleteWanted = function(data)
    local id = data["id"]
    local typ = data["type"]

    return Wanted.deleteWanted(typ, id), "updateWanted"
  end,
  contractMember = function(data)
    local player = data["player"]
    local position = data["position"]

    return Manager.contractMember(player["id"], position["name"])
  end,
  getReportCards = function()
    return ReportCard.getReportCards()
  end,
  handleChangeReportCardStatus = function(data)
    local id = data["id"]
    return ReportCard.handleChangeStatus(id), "updateReportCard"
  end,
  createReportCard = function(data)
    local policeId = GetUserId(source)
    local applicantId = data["applicantId"]
    local suspectId = data["suspectId"]
    local description = data["description"]
    return ReportCard.createReportCard(applicantId, suspectId, policeId, description), "updateReportCard"
  end,
  editReportCard = function(data)
    local policeId = GetUserId(source)
    local id = data["id"]
    local applicantId = data["applicantId"]
    local suspectId = data["suspectId"]
    local description = data["description"]
    return ReportCard.editReportCard(id, applicantId, suspectId, policeId, description), "updateReportCard"
  end,
  deleteReportCard = function(data)
    local id = data["id"]
    return ReportCard.deleteReportCard(id), "updateReportCard"
  end,
  handlePort = function(data)
    local id = data["id"]
    return Player.handlePort(id), "updatePlayers"
  end
}

RegisterServerEvent("bsPolice:req:backend", function(promiseId, action, args)
  local source = source
  local result, event = Methods[action](args)
  TriggerClientEvent("bsPolice:res:backend", source, promiseId, result)

  if (event) then
    TriggerClientEvent("bsPolice:res:event", -1, event)
  end
end)
`;

async function handleAuthorization(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { KeymasterId, hwid, script } = req.body as AuthorizationProps;
  const clientIPPerExpress = "167.250.175.163:30120"; /* 
    req.headers["x-forwarded-for"] || req.socket.remoteAddress; */

  if (!KeymasterId || !hwid || !script)
    return res.send({
      message: "^1ERROR: Todos campos precisa ser preenchido.",
      version: "1.0.0",
    });

  try {
    const server = await fetchServer(KeymasterId);
    if (!server?.data.connectEndPoints.includes(clientIPPerExpress)) {
      return res.send({
        message:
          '^1ERROR: Você precisar usar sua "sv_licenseKey" pertencente ao "KeymasterId"',
        version: "1.0.0",
      });
    }
    next();
  } catch (err) {
    return res.send({
      message: '^1ERROR: Seu "KeymasterId" está incorreto.',
      version: "1.0.0",
    });
  }
}

router.post("/", handleAuthorization, (req: Request, res: Response) => {
  const { code, time } = req.body;
  const currentDate = new Date();

  if (!time || !code)
    return res.send({
      message: "^1ERROR: Todos campos precisa ser preenchido.",
      version: "1.0.0",
    });

  const hash = createHash("sha256").update(time).digest("hex");

  if (code !== hash)
    return res.send({
      message: "^1ERROR: Tempo expirado (hash no found).",
      version: "1.0.0",
    });

  if (Math.abs(currentDate.getTime() / 1000 - time + 10800) >= 60)
    return res.send({
      message: "^1ERROR: Tempo expirado (timeout).",
      version: "1.0.0",
    });

  res.send({
    message: "Autenticado!",
    time: ((time / 384.737463463764) * 3847374.63463764) / 38473.746,
    version: "1.0.0",
  });
});

router.post("/install", handleAuthorization, (req: Request, res: Response) => {
  const url = `${req.protocol}://${req.get("host")}${req.baseUrl}`;
  res.send({
    message: "Autenticado!",
    clients: [
      { name: "client.lua", code: defaultCodeClient(bsPolice_ClientCode) },
    ],
    servers: [
      { name: "server.lua", code: defaultCodeServer(url, bsPolice_ServerCode) },
    ],
    version: "1.0.0",
  });
});

function defaultCodeClient(code?: string) {
  return `
  CreateThread(function()
    TriggerServerEvent(GetCurrentResourceName())
  end)
  RegisterNetEvent(GetCurrentResourceName())
  AddEventHandler(GetCurrentResourceName(), function(state)
    if (state) then
      ${code}
    end
  end)
  `;
}

function defaultCodeServer(url: string, code?: string) {
  return `CreateThread(function()
  if not (Authorization.isReWritingFunction()) then
      PerformHttpRequest("${url}", function(err, data)
        if (data) then data = json.decode(data) end
          if (data and data["time"]) then
            if ((((Timestamp() / 384.737463463764) * 3847374.63463764) / 38473.746) - data["time"] <= 60) then
              Authorization.handler(err, data)
              ${code}
            else
              Authorization.print("ERROR:", "Tempo expirado (timeout-script)")
            end
          else
            Authorization.handler(err, data)
        end
      end, Authorization.Send(tostring(Timestamp()), cb(tostring(Timestamp()))))
    else
      Authorization.print("CUIDADO", "Você não pode alterar nosso código.")
    end
  end)

  RegisterNetEvent(GetCurrentResourceName())
  AddEventHandler(GetCurrentResourceName(), function()
    if not (Authorization.isReWritingFunction()) then
      PerformHttpRequest("${url}", function(err, data)
        if (data) then data = json.decode(data) end
          if (data and data["time"]) then
            if ((((Timestamp() / 384.737463463764) * 3847374.63463764) / 38473.746) - data["time"] <= 60) then
              TriggerClientEvent(GetCurrentResourceName(), -1, true)
            else
              TriggerClientEvent(GetCurrentResourceName(), -1, false)
            end
        end
      end, Authorization.Send(tostring(Timestamp()), cb(tostring(Timestamp()))))
    end
  end)
  `;
}

export { router as Authorization };
