'use strict';
/**
 *  offline-viewer.js
 *  https://github.com/lzh173/xrit-rx
 *
 *  Offline product viewer for received satellite images
 */

var config = {};
var dates = [];
var currentDate = null;
var currentFile = null;      // Currently selected file info {name, path, fc?, ire?}
var currentType = 'FD';      // 'FD' | 'FC' | 'IRE' | (product name for non-FD)
var allProducts = [];        // Raw products array for current date
var refreshTimer = null;
var isViewingLatest = true;
var pollInterval = 30;

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

var typeLabels = {
    'FD': '原图',
    'FC': '假彩色',
    'IRE': '红外增强'
};

function init()
{
    print("正在启动离线产品查看器...", "VIEWER");

    http_get("/api", (res) => {
        if (res.status == 200) {
            res.json().then((data) => {
                config = data;
                configure();
            });
        }
        else {
            print("获取配置失败", "CONF");
            document.getElementById("viewer-body").innerHTML =
                '<div class="empty-msg"><div class="big-icon">⚠</div><p>无法连接到 xrit-rx 服务</p></div>';
        }
    });
}


function configure()
{
    console.log(config);

    var heading = document.getElementById("dash-heading");
    heading.innerHTML = `${config.spacecraft} ${config.downlink} 离线产品查看器`;
    heading.innerHTML += `<span>xrit-rx <a href="https://github.com/lzh173/xrit-rx" target="_blank">v${config.version}</a></span>`;
    document.title = `${config.spacecraft} ${config.downlink} - xrit-rx 离线查看器`;

    setInterval(() => { block_time(); }, 100);
    block_time();

    // Set time block heading
    var timeHeading = document.querySelector('#block-time .block-heading');
    if (timeHeading) timeHeading.textContent = '时间';

    block_schedule_init();
    loadDates();
}


function loadDates()
{
    http_get("/api/offline/dates", (res) => {
        if (res.status == 200) {
            res.json().then((data) => {
                dates = data;
                if (dates.length > 0) {
                    currentDate = dates[0].date;
                    print("已加载日期：" + currentDate, "VIEWER");
                    loadDateProducts(currentDate);
                }
                else {
                    showEmpty("暂无已接收的产品数据<br><span style='font-size:14px;color:#666;'>请先在正常模式下运行 xrit-rx 接收数据</span>");
                }
            });
        }
        else {
            print("获取日期列表失败", "VIEWER");
            showEmpty("无法获取产品日期列表");
        }
    });
}


function loadDateProducts(date)
{
    currentDate = date;
    isViewingLatest = (dates.length > 0 && date == dates[0].date);
    print("正在加载：" + date, "VIEWER");

    http_get(`/api/offline/date/${date}`, (res) => {
        if (res.status == 200) {
            res.json().then((data) => {
                renderViewer(data);
            });
        }
        else {
            showEmpty("该日期无可用产品");
        }
    });
}


function renderViewer(data)
{
    allProducts = data.products || [];
    var body = document.getElementById("viewer-body");
    var hasFD = false;

    // Find FD files
    var fdProduct = null;
    var nonFD = [];
    allProducts.forEach(function(p) {
        if (p.name == 'FD') {
            fdProduct = p;
        } else if (p.name != 'ANT' && p.files && p.files.length > 0) {
            nonFD.push(p);
        }
    });

    if (!fdProduct || !fdProduct.files || fdProduct.files.length === 0) {
        showEmpty("该日期暂无全盘图（FD）数据");
        return;
    }

    var fdFiles = fdProduct.files;

    // Check if currentFile still exists in this date's data
    var fileStillExists = false;
    if (currentFile) {
        for (var pi = 0; pi < allProducts.length && !fileStillExists; pi++) {
            var pf = allProducts[pi].files || [];
            for (var fi = 0; fi < pf.length && !fileStillExists; fi++) {
                if (pf[fi].path === currentFile.path) fileStillExists = true;
            }
        }
    }

    if (!currentFile || !fileStillExists) {
        currentFile = fdFiles[fdFiles.length - 1];
        currentType = 'FD';
        fileChanged = true;
    }

    // Build UI
    var html = '';

    // ——— Date nav ———
    html += '<div class="date-nav">';
    html += '  <button class="nav-btn" id="btn-prev" onclick="navigateDate(-1)">◀</button>';
    html += '  <span class="date-label" id="date-label">' + formatDate(currentDate) + '</span>';
    html += '  <button class="nav-btn" id="btn-next" onclick="navigateDate(1)">▶</button>';
    html += '</div>';

    // ——— Split ———
    html += '<div class="viewer-split">';

    // ——— Product list (left) ———
    html += '  <div class="product-list" id="product-list">';

    // FD group
    html += '    <div class="product-group">';
    html += '      <div class="group-header">FD (' + fdFiles.length + ')</div>';
    fdFiles.forEach(function(f, idx) {
        var num = f.name.replace(/^IMG_FD_(\d+).*$/, '$1');
        var isActive = (currentFile.path === f.path) ? ' active' : '';
        html += '      <div class="product-item' + isActive + '" data-path="' + f.path + '" onclick="selectFile(\'' + f.path.replace(/'/g, "\\'") + '\')">';
        html += '        <span class="item-num">#' + num + '</span>' + formatTimeFromFilename(f.name);
        html += '      </div>';
    });
    html += '    </div>';

    // Non-FD groups
    nonFD.forEach(function(p) {
        html += '    <div class="product-group">';
        html += '      <div class="group-header">' + p.name + ' (' + p.files.length + ')</div>';
        p.files.forEach(function(f) {
            var isActive = (currentFile.path === f.path) ? ' active' : '';
            html += '      <div class="product-item' + isActive + '" onclick="selectFile(\'' + f.path.replace(/'/g, "\\'") + '\')">';
            html += '        ' + formatTimeFromFilename(f.name);
            html += '      </div>';
        });
        html += '    </div>';
    });

    html += '  </div>';

    // ——— Main image area (right) ———
    html += '  <div class="main-area">';

    // Type selector
    html += '    <div class="type-selector" id="type-selector">';
    html += '      <button class="type-btn active" data-type="FD" onclick="switchType(\'FD\')">🖼 原图</button>';
    var hasFC = currentFile && currentFile.fc ? true : false;
    var hasIRE = currentFile && currentFile.ire ? true : false;
    html += '      <button class="type-btn' + (hasFC ? '' : ' disabled') + '" data-type="FC" onclick="switchType(\'FC\')">🎨 假彩色</button>';
    html += '      <button class="type-btn' + (hasIRE ? '' : ' disabled') + '" data-type="IRE" onclick="switchType(\'IRE\')">🔥 红外增强</button>';
    html += '    </div>';

    // Main image
    var imgSrc = getCurrentImageUrl();
    html += '    <div class="main-image-wrap">';
    html += '      <img id="main-img" src="' + imgSrc + '" alt="image" onerror="handleImgError()">';
    html += '      <div class="img-error" id="img-error">图片加载失败</div>';
    html += '    </div>';

    // Info bar
    html += '    <div class="image-info">';
    html += '      <span class="info-type" id="info-type">' + (currentFile.name.match(/^IMG_FD_(\d+)/) ? 'FD #' + RegExp.$1 : currentFile.name) + '</span>';
    html += '      <span class="info-file" id="info-file">' + currentFile.name + '</span>';
    html += '      <span class="info-date">' + formatDate(currentDate) + '</span>';
    html += '      <span><a href="' + imgSrc + '" target="_blank" id="info-link">打开原图</a></span>';
    html += '    </div>';

    html += '  </div>'; // end main-area
    html += '</div>';   // end viewer-split

    body.innerHTML = html;

    updateNavButtons();

    // Schedule next refresh if on latest date
    cancelRefresh();
    if (isViewingLatest) {
        refreshTimer = setTimeout(refreshLatest, pollInterval * 1000);
    }
}


function selectFile(path)
{
    // Find which product this file belongs to
    for (var pi = 0; pi < allProducts.length; pi++) {
        var p = allProducts[pi];
        for (var fi = 0; fi < (p.files || []).length; fi++) {
            if (p.files[fi].path === path) {
                currentFile = p.files[fi];
                currentType = p.name === 'FD' ? 'FD' : p.name;
                renderViewer({"products": allProducts});
                return;
            }
        }
    }
}


function switchType(type)
{
    if (!currentFile) return;

    // For non-FD files, only "original" is valid
    if (currentFile.name.indexOf('FD') === -1 && type !== 'FD') return;

    if (type === 'FC' && !currentFile.fc) return;
    if (type === 'IRE' && !currentFile.ire) return;

    currentType = type;

    var img = document.getElementById("main-img");
    var errDiv = document.getElementById("img-error");
    if (img) {
        img.style.display = 'block';
        if (errDiv) errDiv.style.display = 'none';
        img.src = getCurrentImageUrl();
        document.getElementById("info-link").href = img.src;
    }

    // Update info
    var typeLabel = typeLabels[type] || type;
    var match = currentFile.name.match(/^IMG_FD_(\d+)/);
    if (match) {
        document.getElementById("info-type").textContent = 'FD #' + match[1] + ' ' + typeLabel;
    } else {
        document.getElementById("info-type").textContent = currentFile.name;
    }

    // Update type buttons
    document.querySelectorAll('#type-selector .type-btn').forEach(function(btn) {
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}


function getCurrentImageUrl()
{
    if (!currentFile) return '';
    var path = currentFile.path;
    if (currentType === 'FC' && currentFile.fc) path = currentFile.fc;
    if (currentType === 'IRE' && currentFile.ire) path = currentFile.ire;
    return '/api/' + path.replace(/\\/g, '/');
}


function handleImgError()
{
    var errDiv = document.getElementById("img-error");
    if (errDiv) errDiv.style.display = 'block';
}


function formatTimeFromFilename(name)
{
    // Extract HHMMSS from filename like IMG_FD_025_IR105_20260704_041006.jpg
    var parts = name.split('_');
    for (var i = parts.length - 1; i >= 0; i--) {
        if (/^\d{6}\./.test(parts[i]) || /^\d{6}$/.test(parts[i])) {
            return parts[i].substr(0, 2) + ':' + parts[i].substr(2, 2) + ':' + parts[i].substr(4, 2);
        }
        if (/^\d{6}\.\w{3,4}$/.test(parts[i])) {
            return parts[i].substr(0, 2) + ':' + parts[i].substr(2, 2) + ':' + parts[i].substr(4, 2);
        }
    }
    return name;
}


function navigateDate(direction)
{
    var idx = dates.findIndex(function(d) { return d.date == currentDate; });
    if (idx === -1) return;

    var newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= dates.length) return;

    currentDate = dates[newIdx].date;
    isViewingLatest = (newIdx === 0);
    loadDateProducts(currentDate);
}


function updateNavButtons()
{
    var idx = dates.findIndex(function(d) { return d.date == currentDate; });
    var prevBtn = document.getElementById("btn-prev");
    var nextBtn = document.getElementById("btn-next");
    if (prevBtn) prevBtn.disabled = (idx <= 0);
    if (nextBtn) nextBtn.disabled = (idx >= dates.length - 1);
}


function cancelRefresh()
{
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
}


function refreshLatest()
{
    if (dates.length === 0 || !isViewingLatest) return;

    http_get("/api/offline/dates", (res) => {
        if (res.status === 200) {
            res.json().then((data) => {
                if (!isViewingLatest) return;

                var prevDate = currentDate;
                dates = data;

                if (dates.length > 0) {
                    var latestDate = dates[0].date;
                    if (latestDate !== prevDate) {
                        currentDate = latestDate;
                        var lbl = document.getElementById("date-label");
                        if (lbl) lbl.textContent = formatDate(currentDate);
                        loadDateProducts(latestDate);
                        return;
                    } else {
                        http_get("/api/offline/date/" + currentDate, (res) => {
                            if (res.status === 200) {
                                res.json().then((data) => {
                                    if (!isViewingLatest) return;

                                    var products = data.products || [];
                                    var fdProd = null;
                                    products.forEach(function(p) { if (p.name === 'FD') fdProd = p; });

                                    var oldPath = currentFile ? currentFile.path : '';
                                    var newLatestPath = (fdProd && fdProd.files && fdProd.files.length > 0)
                                        ? fdProd.files[fdProd.files.length - 1].path : '';

                                    // If a new FD image arrived
                                    if (newLatestPath && newLatestPath !== oldPath) {
                                        currentFile = fdProd.files[fdProd.files.length - 1];
                                        currentType = 'FD';
                                        renderViewer(data);
                                        print("检测到新图片", "VIEWER");
                                    } else {
                                        // Just update data in background without re-render
                                        allProducts = products;
                                    }
                                });
                            }
                        });
                    }
                }

                refreshTimer = setTimeout(refreshLatest, pollInterval * 1000);
            });
        }
    });
}


function formatDate(dateStr)
{
    if (!dateStr) return '-';
    return dateStr.substr(0, 4) + '-' + dateStr.substr(4, 2) + '-' + dateStr.substr(6, 2);
}


function showEmpty(msg)
{
    var body = document.getElementById("viewer-body");
    body.innerHTML = '<div class="empty-msg"><div class="big-icon">📭</div><p>' + msg + '</p></div>';
}


/* ——————————— Time block ——————————— */
function block_time()
{
    var block = document.getElementById("block-time");
    if (!block) return;
    var els = block.children[1].children;
    if (els && els.length >= 2) {
        els[0].innerHTML = get_time_local() + '<br><span title="UTC ' + get_time_utc_offset() + '">本地</span>';
        els[1].innerHTML = get_time_utc() + '<br><span>UTC</span>';
    }
}


/* ——————————— Schedule block ——————————— */
function block_schedule_init()
{
    var block = document.getElementById("block-schedule");
    if (!block) return;
    block.children[0].innerHTML = (config.spacecraft || 'GK-2A') + ' ' + (config.downlink || 'LRIT') + ' 计划表';

    var table = document.createElement("table");
    table.className = "schedule";
    table.appendChild(document.createElement("tbody"));

    var thead = table.createTHead();
    var row = thead.insertRow(0);
    row.insertCell(0).innerHTML = "开始时间 (UTC)";
    row.insertCell(1).innerHTML = "结束时间 (UTC)";
    row.insertCell(2).innerHTML = "类型";
    row.insertCell(3).innerHTML = "序号";

    var element = block.children[1];
    element.innerHTML = "";
    element.appendChild(table);

    setInterval(block_schedule_update, 10000);
    block_schedule_update();
    print("计划表就绪", "SCHD");
}


function block_schedule_update()
{
    var block = document.getElementById("block-schedule");
    if (!block || sch.length === 0) return;

    var table = block.children[1].children[0];
    if (!table) return;

    var time = get_time_utc().replace(/:/g, "");
    var body = table.children[1];

    var first = 0;
    for (var entry in sch) {
        if (time < sch[entry][1]) {
            first = Math.max(0, parseInt(entry) - 3);
            break;
        }
    }

    body.innerHTML = "";
    for (var i = first; i < first + 12 && i < sch.length; i++) {
        var start = sch[i][0];
        var end = sch[i][1];
        var row = body.insertRow();

        row.insertCell().innerHTML = start.substr(0, 2) + ':' + start.substr(2, 2) + ':' + start.substr(4, 2);
        row.insertCell().innerHTML = end.substr(0, 2) + ':' + end.substr(2, 2) + ':' + end.substr(4, 2);
        row.insertCell().innerHTML = sch[i][2];
        row.insertCell().innerHTML = sch[i][3];

        if (time > start && i !== sch.length - 1) {
            row.removeAttribute("active");
            row.setAttribute("disabled", "");
        }
        if (time > start && time < end) {
            row.removeAttribute("disabled");
            row.setAttribute("active", "");
        }
    }
}
