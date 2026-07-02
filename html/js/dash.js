'use strict';
/**
 *  dash.js
 *  https://github.com/lzh173/xrit-rx
 *
 *  Updates dashboard data through xrit-rx API
 */

var config = {};
var blocks = {
    vchan:    {
        width: 620,
        height: 180,
        title: "虚拟通道",
        update: block_vchan
    },
    time:     {
        width: 390,
        height: 180,
        title: "时间",
        update: null
    },
    latestimg:  {
        width: 500,
        height: 590,
        title: "最新图片",
        update: block_latestimg
    },
    schedule: {
        width: 510,
        height: 590,
        title: "计划表",
        update: block_schedule
    }
};
var vchans = {
    "GK-2A": {
        0:  ["FD", "圆盘图"],
        4:  ["ANT", "文本"],
        5:  ["ADD", "附加数据"],
        63: ["IDLE", "无数据"]
    }
};
var sch = [
  ["001006", "001236", "FD", "001", "FD", true],
  ["002006", "002236", "FD", "002", "FD", true],
  ["003006", "003236", "FD", "003", "FD", true],
  ["004006", "004236", "FD", "004", "FD", true],
  ["005006", "005236", "FD", "005", "FD", true],
  ["010006", "010236", "FD", "006", "FD", true],
  ["011006", "011236", "FD", "007", "FD", true],
  ["011300", "011330", "TYIA", "001", "", true],
  ["012006", "012236", "FD", "008", "FD", true],
  ["013006", "013236", "FD", "009", "FD", true],
  ["013300", "013930", "COMSIR1", "001", "", true],
  ["014006", "014236", "FD", "010", "FD", true],
  ["014300", "014330", "TYIB", "001", "", true],
  ["014335", "014405", "RWW3A", "001", "", true],
  ["014410", "014935", "COMSFOG", "001", "", true],
  ["015006", "015236", "FD", "011", "FD", true],
  ["020006", "020236", "FD", "012", "FD", true],
  ["020300", "020340", "SUFA03", "001", "", true],
  ["021006", "021236", "FD", "013", "FD", true],
  ["022006", "022236", "FD", "014", "FD", true],
  ["022300", "022330", "SSTA", "001", "", true],
  ["022335", "022405", "SSTA", "002", "", true],
  ["022410", "022440", "SSTA", "003", "", true],
  ["023006", "023236", "FD", "015", "FD", true],
  ["024006", "024236", "FD", "016", "FD", true],
  ["025006", "025236", "FD", "017", "FD", true],
  ["030006", "030236", "FD", "018", "FD", true],
  ["031006", "031236", "FD", "019", "FD", true],
  ["032006", "032236", "FD", "020", "FD", true],
  ["032915", "032920", "ANT", "001", "", true],
  ["033006", "033236", "FD", "021", "FD", true],
  ["034006", "034236", "FD", "022", "FD", true],
  ["035006", "035236", "FD", "023", "FD", true],
  ["040006", "040236", "FD", "024", "FD", true],
  ["041006", "041236", "FD", "025", "FD", true],
  ["041300", "041330", "TYIA", "002", "", true],
  ["042006", "042236", "FD", "026", "FD", true],
  ["043006", "043236", "FD", "027", "FD", true],
  ["044006", "044236", "FD", "028", "FD", true],
  ["044300", "044330", "RWW3A", "002", "", true],
  ["044335", "044900", "COMSFOG", "002", "", true],
  ["045006", "045236", "FD", "029", "FD", true],
  ["050006", "050236", "FD", "030", "FD", true],
  ["050300", "050340", "SUFA03", "002", "", true],
  ["051006", "051236", "FD", "031", "FD", true],
  ["051300", "051330", "TYIB", "002", "", true],
  ["051600", "051630", "UP50A", "001", "", true],
  ["052006", "052236", "FD", "032", "FD", true],
  ["053006", "053236", "FD", "033", "FD", true],
  ["053300", "053340", "RWW3M", "001", "", true],
  ["053345", "053425", "RWW3M", "002", "", true],
  ["053430", "053510", "RWW3M", "003", "", true],
  ["053515", "053555", "RWW3M", "004", "", true],
  ["053600", "053640", "RWW3M", "005", "", true],
  ["053645", "053725", "RWW3M", "006", "", true],
  ["053730", "053810", "RWW3M", "007", "", true],
  ["053815", "053855", "RWW3M", "008", "", true],
  ["054006", "054236", "FD", "034", "FD", true],
  ["054300", "054340", "RWW3M", "009", "", true],
  ["054345", "054425", "RWW3M", "010", "", true],
  ["054430", "054510", "RWW3M", "011", "", true],
  ["054515", "054555", "RWW3M", "012", "", true],
  ["054600", "054640", "RWW3M", "013", "", true],
  ["054645", "054725", "RWW3M", "014", "", true],
  ["054730", "054810", "RWW3M", "015", "", true],
  ["054815", "054855", "RWW3M", "016", "", true],
  ["055006", "055236", "FD", "035", "FD", true],
  ["055300", "055340", "RWW3M", "017", "", true],
  ["055345", "055425", "RWW3M", "018", "", true],
  ["055430", "055510", "RWW3M", "019", "", true],
  ["055515", "055555", "RWW3M", "020", "", true],
  ["055600", "055640", "RWW3M", "021", "", true],
  ["055645", "055725", "RWW3M", "022", "", true],
  ["055730", "055810", "RWW3M", "023", "", true],
  ["055815", "055855", "RWW3M", "024", "", true],
  ["060006", "060236", "FD", "036", "FD", true],
  ["060300", "060340", "RWW3M", "025", "", true],
  ["060500", "060630", "SUFA12", "001", "", true],
  ["060700", "060840", "SUFF24", "001", "", true],
  ["061006", "061236", "FD", "037", "FD", true],
  ["061300", "061520", "UP50F24", "001", "", true],
  ["061525", "061745", "UP50F48", "001", "", true],
  ["062006", "062236", "FD", "038", "FD", true],
  ["062300", "062330", "RWW3F", "001", "", true],
  ["062335", "062405", "RWW3F", "002", "", true],
  ["062410", "062440", "RWW3F", "003", "", true],
  ["062445", "062515", "RWW3F", "004", "", true],
  ["062520", "062550", "RWW3F", "005", "", true],
  ["062555", "062625", "RWW3F", "006", "", true],
  ["062630", "062700", "RWW3F", "007", "", true],
  ["062705", "062735", "RWW3F", "008", "", true],
  ["062740", "062810", "RWW3F", "009", "", true],
  ["062815", "062845", "RWW3F", "010", "", true],
  ["063006", "063236", "FD", "039", "FD", true],
  ["063300", "063330", "RWW3F", "011", "", true],
  ["063335", "063405", "RWW3F", "012", "", true],
  ["063410", "063440", "RWW3F", "013", "", true],
  ["063445", "063515", "RWW3F", "014", "", true],
  ["063520", "063550", "RWW3F", "015", "", true],
  ["063555", "063625", "RWW3F", "016", "", true],
  ["063630", "063700", "RWW3F", "017", "", true],
  ["063705", "063735", "RWW3F", "018", "", true],
  ["063740", "063810", "RWW3F", "019", "", true],
  ["063815", "063845", "RWW3F", "020", "", true],
  ["064006", "064236", "FD", "040", "FD", true],
  ["064300", "064330", "RWW3F", "021", "", true],
  ["064335", "064405", "RWW3F", "022", "", true],
  ["064410", "064440", "RWW3F", "023", "", true],
  ["064445", "064515", "RWW3F", "024", "", true],
  ["064520", "064550", "RWW3F", "025", "", true],
  ["064555", "064625", "RWW3F", "026", "", true],
  ["064630", "064700", "RWW3F", "027", "", true],
  ["064705", "064735", "RWW3F", "028", "", true],
  ["064740", "064810", "RWW3F", "029", "", true],
  ["064815", "064845", "RWW3F", "030", "", true],
  ["065006", "065236", "FD", "041", "FD", true],
  ["065300", "065340", "GWW3F", "001", "", true],
  ["065345", "065425", "GWW3F", "002", "", true],
  ["065430", "065510", "GWW3F", "003", "", true],
  ["065515", "065555", "GWW3F", "004", "", true],
  ["065600", "065640", "GWW3F", "005", "", true],
  ["065645", "065725", "GWW3F", "006", "", true],
  ["065730", "065810", "GWW3F", "007", "", true],
  ["065815", "065855", "GWW3F", "008", "", true],
  ["070006", "070236", "FD", "042", "FD", true],
  ["070300", "070340", "GWW3F", "009", "", true],
  ["070345", "070425", "GWW3F", "010", "", true],
  ["070430", "070510", "GWW3F", "011", "", true],
  ["070515", "070555", "GWW3F", "012", "", true],
  ["070600", "070640", "GWW3F", "013", "", true],
  ["070645", "070725", "GWW3F", "014", "", true],
  ["070730", "070810", "GWW3F", "015", "", true],
  ["070815", "070855", "GWW3F", "016", "", true],
  ["071006", "071236", "FD", "043", "FD", true],
  ["071300", "071330", "TYIA", "003", "", true],
  ["071335", "071415", "GWW3F", "017", "", true],
  ["071420", "071500", "GWW3F", "018", "", true],
  ["071505", "071545", "GWW3F", "019", "", true],
  ["071550", "071630", "GWW3F", "020", "", true],
  ["071635", "071715", "GWW3F", "021", "", true],
  ["071720", "071800", "GWW3F", "022", "", true],
  ["071805", "071845", "GWW3F", "023", "", true],
  ["071850", "071930", "GWW3F", "024", "", true],
  ["072006", "072236", "FD", "044", "FD", true],
  ["072300", "072340", "GWW3F", "025", "", true],
  ["072345", "072425", "GWW3F", "026", "", true],
  ["072430", "072510", "GWW3F", "027", "", true],
  ["072515", "072555", "GWW3F", "028", "", true],
  ["072600", "072640", "GWW3F", "029", "", true],
  ["072645", "072725", "GWW3F", "030", "", true],
  ["072730", "072810", "GWW3F", "031", "", true],
  ["072815", "072855", "GWW3F", "032", "", true],
  ["073006", "073236", "FD", "045", "FD", true],
  ["073300", "073930", "COMSIR1", "002", "", true],
  ["074006", "074236", "FD", "046", "FD", true],
  ["074300", "074330", "TYIB", "003", "", true],
  ["074335", "074405", "RWW3A", "003", "", true],
  ["075006", "075236", "FD", "047", "FD", true],
  ["075300", "075340", "GWW3F", "033", "", true],
  ["075345", "075425", "GWW3F", "034", "", true],
  ["075430", "075510", "GWW3F", "035", "", true],
  ["075515", "075555", "GWW3F", "036", "", true],
  ["075600", "075640", "GWW3F", "037", "", true],
  ["075645", "075725", "GWW3F", "038", "", true],
  ["075730", "075810", "GWW3F", "039", "", true],
  ["075815", "075855", "GWW3F", "040", "", true],
  ["080006", "080236", "FD", "048", "FD", true],
  ["080300", "080340", "SUFA03", "003", "", true],
  ["081006", "081236", "FD", "049", "FD", true],
  ["081300", "081405", "SSTF24", "001", "", true],
  ["081500", "081605", "SSTF48", "001", "", true],
  ["081700", "081805", "SSTF72", "001", "", true],
  ["082006", "082236", "FD", "050", "FD", true],
  ["082300", "082325", "FOGVIS", "001", "", true],
  ["082330", "082355", "FOGVIS", "002", "", true],
  ["082400", "082425", "FOGVIS", "003", "", true],
  ["082430", "082455", "FOGVIS", "004", "", true],
  ["082500", "082525", "FOGVIS", "005", "", true],
  ["082530", "082555", "FOGVIS", "006", "", true],
  ["082600", "082625", "FOGVIS", "007", "", true],
  ["082630", "082655", "FOGVIS", "008", "", true],
  ["082700", "082725", "FOGVIS", "009", "", true],
  ["082730", "082755", "FOGVIS", "010", "", true],
  ["082800", "082825", "FOGVIS", "011", "", true],
  ["082830", "082855", "FOGVIS", "012", "", true],
  ["082900", "082925", "FOGVIS", "013", "", true],
  ["083006", "083236", "FD", "051", "FD", true],
  ["083300", "083340", "SICEA", "001", "", true],
  ["083400", "083440", "SICEF24", "001", "", true],
  ["083500", "083540", "SICEF48", "001", "", true],
  ["083545", "083610", "FOGVIS", "014", "", true],
  ["083615", "083640", "FOGVIS", "015", "", true],
  ["083645", "083710", "FOGVIS", "016", "", true],
  ["084006", "084236", "FD", "052", "FD", true],
  ["084300", "084415", "FCT", "001", "", true],
  ["084420", "084535", "FCT", "002", "", true],
  ["084540", "084655", "FCT", "003", "", true],
  ["084700", "084815", "FCT", "004", "", true],
  ["085006", "085236", "FD", "053", "FD", true],
  ["090006", "090236", "FD", "054", "FD", true],
  ["090300", "090339", "GWW3F", "041", "", true],
  ["090344", "090423", "GWW3F", "042", "", true],
  ["090428", "090507", "GWW3F", "043", "", true],
  ["090512", "090551", "GWW3F", "044", "", true],
  ["090556", "090635", "GWW3F", "045", "", true],
  ["090640", "090719", "GWW3F", "046", "", true],
  ["090724", "090803", "GWW3F", "047", "", true],
  ["090808", "090847", "GWW3F", "048", "", true],
  ["090852", "090931", "GWW3F", "049", "", true],
  ["091006", "091236", "FD", "055", "FD", true],
  ["091300", "091330", "UP50A", "002", "", true],
  ["091335", "091440", "SSTF24", "002", "", true],
  ["091445", "091550", "SSTF48", "002", "", true],
  ["091555", "091700", "SSTF72", "002", "", true],
  ["091705", "091810", "SSTF24", "003", "", true],
  ["091815", "091920", "SSTF48", "003", "", true],
  ["092006", "092236", "FD", "056", "FD", true],
  ["092300", "092405", "SSTF72", "003", "", true],
  ["092410", "092515", "SSTF24", "004", "", true],
  ["092520", "092625", "SSTF48", "004", "", true],
  ["092630", "092735", "SSTF72", "004", "", true],
  ["093006", "093236", "FD", "057", "FD", true],
  ["094006", "094236", "FD", "058", "FD", true],
  ["094300", "094415", "FCT", "005", "", true],
  ["094420", "094535", "FCT", "006", "", true],
  ["095006", "095236", "FD", "059", "FD", true],
  ["100006", "100236", "FD", "060", "FD", true],
  ["101006", "101236", "FD", "061", "FD", true],
  ["101300", "101330", "TYIA", "004", "", true],
  ["102006", "102236", "FD", "062", "FD", true],
  ["103006", "103236", "FD", "063", "FD", true],
  ["104006", "104236", "FD", "064", "FD", true],
  ["104300", "104330", "TYIB", "004", "", true],
  ["104335", "104405", "RWW3A", "004", "", true],
  ["105006", "105236", "FD", "065", "FD", true],
  ["110006", "110236", "FD", "066", "FD", true],
  ["110300", "110340", "SUFA03", "004", "", true],
  ["111006", "111236", "FD", "067", "FD", true],
  ["112006", "112236", "FD", "068", "FD", true],
  ["113006", "113236", "FD", "069", "FD", true],
  ["114006", "114236", "FD", "070", "FD", true],
  ["115006", "115236", "FD", "071", "FD", true],
  ["120006", "120236", "FD", "072", "FD", true],
  ["121006", "121236", "FD", "073", "FD", true],
  ["122006", "122236", "FD", "074", "FD", true],
  ["123006", "123236", "FD", "075", "FD", true],
  ["124006", "124236", "FD", "076", "FD", true],
  ["125006", "125236", "FD", "077", "FD", true],
  ["130006", "130236", "FD", "078", "FD", true],
  ["131006", "131236", "FD", "079", "FD", true],
  ["131300", "131330", "TYIA", "005", "", true],
  ["132006", "132236", "FD", "080", "FD", true],
  ["133006", "133236", "FD", "081", "FD", true],
  ["133300", "133930", "COMSIR1", "003", "", true],
  ["134006", "134236", "FD", "082", "FD", true],
  ["134300", "134330", "TYIB", "005", "", true],
  ["134335", "134405", "RWW3A", "005", "", true],
  ["135006", "135236", "FD", "083", "FD", true],
  ["140006", "140236", "FD", "084", "FD", true],
  ["140300", "140340", "SUFA03", "005", "", true],
  ["141006", "141236", "FD", "085", "FD", true],
  ["142006", "142236", "FD", "086", "FD", true],
  ["143006", "143236", "FD", "087", "FD", true],
  ["144006", "144236", "FD", "088", "FD", true],
  ["145006", "145236", "FD", "089", "FD", true],
  ["150006", "150236", "FD", "090", "FD", true],
  ["151006", "151236", "FD", "091", "FD", true],
  ["152006", "152236", "FD", "092", "FD", true],
  ["154006", "154236", "FD", "093", "FD", true],
  ["155006", "155236", "FD", "094", "FD", true],
  ["160006", "160236", "FD", "095", "FD", true],
  ["161006", "161236", "FD", "096", "FD", true],
  ["161300", "161330", "TYIA", "006", "", true],
  ["162006", "162236", "FD", "097", "FD", true],
  ["163006", "163236", "FD", "098", "FD", true],
  ["164006", "164236", "FD", "099", "FD", true],
  ["164300", "164330", "RWW3A", "006", "", true],
  ["165006", "165236", "FD", "100", "FD", true],
  ["165300", "165330", "TYIB", "006", "", true],
  ["170006", "170236", "FD", "101", "FD", true],
  ["170300", "170340", "SUFA03", "006", "", true],
  ["171006", "171236", "FD", "102", "FD", true],
  ["171300", "171330", "UP50A", "003", "", true],
  ["172006", "172236", "FD", "103", "FD", true],
  ["173006", "173236", "FD", "104", "FD", true],
  ["173300", "173340", "RWW3M", "026", "", true],
  ["173345", "173425", "RWW3M", "027", "", true],
  ["173430", "173510", "RWW3M", "028", "", true],
  ["173515", "173555", "RWW3M", "029", "", true],
  ["173600", "173640", "RWW3M", "030", "", true],
  ["173645", "173725", "RWW3M", "031", "", true],
  ["173730", "173810", "RWW3M", "032", "", true],
  ["173815", "173855", "RWW3M", "033", "", true],
  ["174006", "174236", "FD", "105", "FD", true],
  ["174300", "174340", "RWW3M", "034", "", true],
  ["174345", "174425", "RWW3M", "035", "", true],
  ["174430", "174510", "RWW3M", "036", "", true],
  ["174515", "174555", "RWW3M", "037", "", true],
  ["174600", "174640", "RWW3M", "038", "", true],
  ["174645", "174725", "RWW3M", "039", "", true],
  ["174730", "174810", "RWW3M", "040", "", true],
  ["174815", "174855", "RWW3M", "041", "", true],
  ["175006", "175236", "FD", "106", "FD", true],
  ["175300", "175340", "RWW3M", "042", "", true],
  ["175345", "175425", "RWW3M", "043", "", true],
  ["175430", "175510", "RWW3M", "044", "", true],
  ["175515", "175555", "RWW3M", "045", "", true],
  ["175600", "175640", "RWW3M", "046", "", true],
  ["175645", "175725", "RWW3M", "047", "", true],
  ["175730", "175810", "RWW3M", "048", "", true],
  ["175815", "175855", "RWW3M", "049", "", true],
  ["180006", "180236", "FD", "107", "FD", true],
  ["180300", "180340", "RWW3M", "050", "", true],
  ["180500", "180630", "SUFA12", "002", "", true],
  ["180635", "180815", "SUFF24", "002", "", true],
  ["181006", "181236", "FD", "108", "FD", true],
  ["181300", "181520", "UP50F24", "002", "", true],
  ["181525", "181745", "UP50F48", "002", "", true],
  ["182006", "182236", "FD", "109", "FD", true],
  ["182300", "182330", "RWW3F", "031", "", true],
  ["182335", "182405", "RWW3F", "032", "", true],
  ["182410", "182440", "RWW3F", "033", "", true],
  ["182445", "182515", "RWW3F", "034", "", true],
  ["182520", "182550", "RWW3F", "035", "", true],
  ["182555", "182625", "RWW3F", "036", "", true],
  ["182630", "182700", "RWW3F", "037", "", true],
  ["182705", "182735", "RWW3F", "038", "", true],
  ["182740", "182810", "RWW3F", "039", "", true],
  ["182815", "182845", "RWW3F", "040", "", true],
  ["183006", "183236", "FD", "110", "FD", true],
  ["183300", "183330", "RWW3F", "041", "", true],
  ["183335", "183405", "RWW3F", "042", "", true],
  ["183410", "183440", "RWW3F", "043", "", true],
  ["183445", "183515", "RWW3F", "044", "", true],
  ["183520", "183550", "RWW3F", "045", "", true],
  ["183555", "183625", "RWW3F", "046", "", true],
  ["183630", "183700", "RWW3F", "047", "", true],
  ["183705", "183735", "RWW3F", "048", "", true],
  ["183740", "183810", "RWW3F", "049", "", true],
  ["183815", "183845", "RWW3F", "050", "", true],
  ["184006", "184236", "FD", "111", "FD", true],
  ["184300", "184330", "RWW3F", "051", "", true],
  ["184335", "184405", "RWW3F", "052", "", true],
  ["184410", "184440", "RWW3F", "053", "", true],
  ["184445", "184515", "RWW3F", "054", "", true],
  ["184520", "184550", "RWW3F", "055", "", true],
  ["184555", "184625", "RWW3F", "056", "", true],
  ["184630", "184700", "RWW3F", "057", "", true],
  ["184705", "184735", "RWW3F", "058", "", true],
  ["184740", "184810", "RWW3F", "059", "", true],
  ["184815", "184845", "RWW3F", "060", "", true],
  ["185006", "185236", "FD", "112", "FD", true],
  ["185300", "185340", "GWW3F", "050", "", true],
  ["185345", "185425", "GWW3F", "051", "", true],
  ["185430", "185510", "GWW3F", "052", "", true],
  ["185515", "185555", "GWW3F", "053", "", true],
  ["185600", "185640", "GWW3F", "054", "", true],
  ["185645", "185725", "GWW3F", "055", "", true],
  ["185730", "185810", "GWW3F", "056", "", true],
  ["185815", "185855", "GWW3F", "057", "", true],
  ["190006", "190236", "FD", "113", "FD", true],
  ["190300", "190340", "GWW3F", "058", "", true],
  ["190345", "190425", "GWW3F", "059", "", true],
  ["190430", "190510", "GWW3F", "060", "", true],
  ["190515", "190555", "GWW3F", "061", "", true],
  ["190600", "190640", "GWW3F", "062", "", true],
  ["190645", "190725", "GWW3F", "063", "", true],
  ["190730", "190810", "GWW3F", "064", "", true],
  ["190815", "190855", "GWW3F", "065", "", true],
  ["191006", "191236", "FD", "114", "FD", true],
  ["191300", "191330", "TYIA", "007", "", true],
  ["191335", "191415", "GWW3F", "066", "", true],
  ["191420", "191500", "GWW3F", "067", "", true],
  ["191505", "191545", "GWW3F", "068", "", true],
  ["191550", "191630", "GWW3F", "069", "", true],
  ["191635", "191715", "GWW3F", "070", "", true],
  ["191720", "191800", "GWW3F", "071", "", true],
  ["191805", "191845", "GWW3F", "072", "", true],
  ["191850", "191930", "GWW3F", "073", "", true],
  ["192006", "192236", "FD", "115", "FD", true],
  ["192300", "192340", "GWW3F", "074", "", true],
  ["192345", "192425", "GWW3F", "075", "", true],
  ["192430", "192510", "GWW3F", "076", "", true],
  ["192515", "192555", "GWW3F", "077", "", true],
  ["192600", "192640", "GWW3F", "078", "", true],
  ["192645", "192725", "GWW3F", "079", "", true],
  ["192730", "192810", "GWW3F", "080", "", true],
  ["192815", "192855", "GWW3F", "081", "", true],
  ["193006", "193236", "FD", "116", "FD", true],
  ["193300", "193930", "COMSIR1", "004", "", true],
  ["194006", "194236", "FD", "117", "FD", true],
  ["194300", "194330", "TYIB", "007", "", true],
  ["194335", "194405", "RWW3A", "007", "", true],
  ["194410", "194935", "COMSFOG", "003", "", true],
  ["195006", "195236", "FD", "118", "FD", true],
  ["195300", "195340", "GWW3F", "082", "", true],
  ["195345", "195425", "GWW3F", "083", "", true],
  ["195430", "195510", "GWW3F", "084", "", true],
  ["195515", "195555", "GWW3F", "085", "", true],
  ["195600", "195640", "GWW3F", "086", "", true],
  ["195645", "195725", "GWW3F", "087", "", true],
  ["195730", "195810", "GWW3F", "088", "", true],
  ["195815", "195855", "GWW3F", "089", "", true],
  ["200006", "200236", "FD", "119", "FD", true],
  ["200300", "200340", "SUFA03", "007", "", true],
  ["201006", "201236", "FD", "120", "FD", true],
  ["202006", "202236", "FD", "121", "FD", true],
  ["202300", "202339", "GWW3F", "090", "", true],
  ["202344", "202423", "GWW3F", "091", "", true],
  ["202428", "202507", "GWW3F", "092", "", true],
  ["202512", "202551", "GWW3F", "093", "", true],
  ["202556", "202635", "GWW3F", "094", "", true],
  ["202640", "202719", "GWW3F", "095", "", true],
  ["202724", "202803", "GWW3F", "096", "", true],
  ["202808", "202847", "GWW3F", "097", "", true],
  ["202852", "202931", "GWW3F", "098", "", true],
  ["203006", "203236", "FD", "122", "FD", true],
  ["204006", "204236", "FD", "123", "FD", true],
  ["204300", "204415", "FCT", "007", "", true],
  ["204420", "204535", "FCT", "008", "", true],
  ["204540", "204655", "FCT", "009", "", true],
  ["204700", "204815", "FCT", "010", "", true],
  ["205006", "205236", "FD", "124", "FD", true],
  ["210006", "210236", "FD", "125", "FD", true],
  ["211006", "211236", "FD", "126", "FD", true],
  ["211300", "211330", "UP50A", "004", "", true],
  ["212006", "212236", "FD", "127", "FD", true],
  ["213006", "213236", "FD", "128", "FD", true],
  ["214006", "214236", "FD", "129", "FD", true],
  ["214300", "214415", "FCT", "011", "", true],
  ["214420", "214535", "FCT", "012", "", true],
  ["215006", "215236", "FD", "130", "FD", true],
  ["220006", "220236", "FD", "131", "FD", true],
  ["221006", "221236", "FD", "132", "FD", true],
  ["221300", "221330", "TYIA", "008", "", true],
  ["222006", "222236", "FD", "133", "FD", true],
  ["223006", "223236", "FD", "134", "FD", true],
  ["224006", "224236", "FD", "135", "FD", true],
  ["224300", "224330", "TYIB", "008", "", true],
  ["224335", "224405", "RWW3A", "008", "", true],
  ["224410", "224935", "COMSFOG", "004", "", true],
  ["225006", "225236", "FD", "136", "FD", true],
  ["230006", "230236", "FD", "137", "FD", true],
  ["230300", "230340", "SUFA03", "008", "", true],
  ["231006", "231236", "FD", "138", "FD", true],
  ["232006", "232236", "FD", "139", "FD", true],
  ["233006", "233236", "FD", "140", "FD", true],
  ["234006", "234236", "FD", "141", "FD", true],
  ["235006", "235236", "FD", "142", "FD", true],
  ["000006", "000236", "FD", "143", "FD", true],
];
var current_vcid;
var latest_image;
var utc_date = "20260627";

function init()
{
    print("正在启动面板...", "DASH");

    // Get config object from xrit-rx
    http_get("/api", (res) => {
        if (res.status == 200) {
            res.json().then((data) => {
                config = data;

                // Configure dashboard
                if (!configure()) { return; }
                print("完成！", "DASH");
            })
        }
        else {
            print("获取配置失败", "CONF");
            return false;
        }
    });
}


/**
 * Configure dashboard
 */
function configure()
{
    // Write config object to console
    console.log(config);

    // Set heading and window title
    var heading = document.getElementById("dash-heading");
    heading.innerHTML =  `${config.spacecraft} ${config.downlink} 仪表板`;
    heading.innerHTML += `<span>xrit-rx <a href="https://github.com/lzh173/xrit-rx/releases/tag/v${config.version}" target="_blank" title="在 GitHub 上查看发布说明">v${config.version}</a></span>`;
    document.title = `${config.spacecraft} ${config.downlink} - xrit-rx v${config.version}`;

    // Build blocks
    console.log(blocks);
    for (var block in blocks) {
        var el = document.getElementById(`block-${block}`);
        blocks[block].body = el.children[1];

        // Set block size
        el.style.width  = `${blocks[block].width}px`;
        el.style.height = `${blocks[block].height}px`;

        // Set block heading
        el.children[0].innerText = blocks[block].title;
    }

    // Parse and build schedule
    if (config.spacecraft == "GK-2A") { get_schedule() };

    // Setup clock loop
    setInterval(() => {
        block_time(blocks.time.body);
    }, 100);
    block_time(blocks.time.body);

    // Setup polling loop
    setInterval(poll, config.interval * 1000);
    poll();
    poll();

    return true;
}


/**
 * Poll xrit-rx API for updated data
 */
function poll()
{
    // Get current VCID
    http_get("/api/current/vcid", (res) => {
        if (res.status == 200) {
            res.json().then((data) => {
                current_vcid = data['vcid'];
            });
        }
        else {
            print("获取当前 VCID 失败", "POLL");
            return false;
        }
    });

    // Get last image
    http_get("/api/latest/image", (res) => {
        if (res.status == 200) {
            res.json().then((data) => {
                latest_image = data['image'];
            });
        }
        else {
            print("获取最新图片失败", "POLL");
            return false;
        }
    });

    // Call update function for each block
    for (var block in blocks) {
        if (blocks[block].update != null) {
            blocks[block].update(blocks[block].body);
        }
    }
}


/**
 * Initialize schedule table from hardcoded data
 */
function get_schedule()
{
    // Create schedule table
    var table = document.createElement("table");
    table.className = "schedule";
    table.appendChild(document.createElement("tbody"));

    // Table header
    var header = table.createTHead();
    var row = header.insertRow(0);
    row.insertCell(0).innerHTML = "开始时间 (UTC)";
    row.insertCell(1).innerHTML = "结束时间 (UTC)";
    row.insertCell(2).innerHTML = "类型";
    row.insertCell(3).innerHTML = "序号";

    // Add table to document
    var element = blocks['schedule'].body;
    element.innerHTML = "";
    element.appendChild(table);

    print("就绪（硬编码数据）", "SCHD");
}


/**
 * Update Virtual Channel block
 */
function block_vchan(element)
{
    // Check block has been built
    if (element.innerHTML == "") {
        for (var ch in vchans[config.spacecraft]) {
            var indicator = document.createElement("span");
            indicator.className = "vchan";
            indicator.id = `vcid-${ch}`
            indicator.title = vchans[config.spacecraft][ch][1];

            var name = vchans[config.spacecraft][ch][0];
            indicator.innerHTML = `<span>${name}</span><p>VCID ${ch}</p>`;

            // Set 'disabled' attribute on blacklisted VCIDs
            if (config.vcid_blacklist.indexOf(parseInt(ch)) > -1) {
                indicator.setAttribute("disabled", "");
                indicator.title += "（已列入黑名单）";
            }

            element.appendChild(indicator);
        }
    }
    else {  // Update block
        for (var ch in vchans[config.spacecraft]) {
            // Do not update blacklisted channels
            if (config.vcid_blacklist.indexOf(parseInt(ch)) > -1) { continue; }

            // Update active channel
            if (ch == current_vcid) {
                document.getElementById(`vcid-${ch}`).setAttribute("active", "");
            }
            else {
                document.getElementById(`vcid-${ch}`).removeAttribute("active");
            }
        }
    }
}


/**
 * Update Time block
 */
function block_time(element)
{
    var local = element.children[0];
    var utc = element.children[1];

    local.innerHTML = `${get_time_local()}<br><span title="UTC ${get_time_utc_offset()}">本地</span>`;
    utc.innerHTML = `${get_time_utc()}<br><span>UTC</span>`;
}


/**
 * Update Latest Image block
 */
function block_latestimg(element)
{
    var img = element.children[0].children[0];
    var link = element.children[0];
    var cap = element.children[2];

    if (latest_image) {
        var url = `/api/${latest_image}`;
        var fname = url.split('/');
        fname = fname[fname.length - 1];
        var ext = fname.split('.')[1];
        fname = fname.split('.')[0];

        // Set <img> src attribute
        if (ext != "txt") {
            // Only update image element if URL has changed
            if (img.getAttribute("src") != url) {
                img.setAttribute("src", url);
                link.setAttribute("href", url);
                cap.innerText = fname;
            }
        }
    }
    else {
        // Check image output is enabled
        if (config.images == false) {
            cap.innerHTML = "xrit-rx 中已禁用图像输出<br><br>请检查密钥文件是否存在，并在 <code>xrit-rx.ini</code> 配置文件中设置 <code>images = true</code>";
        }
        else {
            link.innerHTML = "<img class=\"latestimg\">";
            link.setAttribute("href", "#");
            cap.innerText = "等待图像...";
        }
    }
}


/**
 * Update Schedule block
 */
function block_schedule(element)
{
    // Check schedule has been loaded
    if (sch.length == 0) { return; }

    // Add spacecraft and downlink to block header
    var header = element.parentNode.children[0];
    header.innerHTML = `${config.spacecraft} ${config.downlink} 计划表`;

    // Get current UTC time
    var time = get_time_utc().replace(/:/g, "");

    // Get table body element
    var body = element.children[0].children[1];

    // Find first entry to add to table
    var first;
    for (var entry in sch) {
        var start = sch[entry][0];
        var end = sch[entry][1];

        if (time < start) {
            first = Math.max(0, parseInt(entry) - 3);
            break;
        }
    }

    body.innerHTML = "";
    for (var i = first; i < first + 12; i++) {
        // Limit index
        if (i >= sch.length) { break; }

        var start = sch[i][0];
        var end = sch[i][1];
        var row = body.insertRow();

        // Add cells to row
        row.insertCell().innerHTML = `${sch[i][0].substr(0, 2)}:${sch[i][0].substr(2, 2)}:${sch[i][0].substr(4, 2)}`;
        row.insertCell().innerHTML = `${sch[i][1].substr(0, 2)}:${sch[i][1].substr(2, 2)}:${sch[i][1].substr(4, 2)}`;
        row.insertCell().innerHTML = sch[i][2];
        row.insertCell().innerHTML = sch[i][3];

        // Set past entries as disabled (except last entry)
        if (time > start && i != sch.length - 1) {
            row.removeAttribute("active", "");
            row.setAttribute("disabled", "");
        }

        // Set current entry as active
        if (time > start && time < end) {
            row.removeAttribute("disabled", "");
            row.setAttribute("active", "");
        }
    }
}
