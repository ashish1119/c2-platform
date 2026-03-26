#define _CRT_SECURE_NO_WARNINGS

#include <iostream>
#include <thread>
#include <iomanip>
#include <fstream>
#include <map>
#include <mutex>

#include <boost/algorithm/string.hpp>
#include <boost/filesystem.hpp>

#include <roofcore/utils/Configuration.h>
#include <roofcore/utils/program_name.h>
#include <roofcore/utils/ReadConfiguration.h>

#include <roofipc/MessageSubscriber.h>
#include <roofipc/TransportProtocolParser.h>

#include <roofifmsg/IFData_t.h>
#include <roofifmsg/EmissionProfile_t.h>
#include <roofifmsg/ifmsgdefines.h>

#include <roofcore/math/roofmath_constants.h>

#define DEF_CONFIG_FILE_PATH "./config/setup.config"

namespace RCU = ROOF::core::utils;
namespace RI  = ROOF::ipc;
namespace RIF = ROOF::ifmsg;

std::map<uint32_t, RIF::EmissionProfile_t> g_emissions;
std::mutex g_mutex;

// ================= STATUS =================
std::string getStatus(RIF::EmissionStatus_t status)
{
    switch (status)
    {
    case RIF::ES_NEW: return "NEW";
    case RIF::ES_UPDATE: return "UPDATE";
    case RIF::ES_HOLD: return "HOLD";
    case RIF::ES_OBSOLETE: return "OBSOLETE";
    case RIF::ES_PENDING: return "PENDING";
    default: return "UNKNOWN";
    }
}

// ================= CSV =================
void writeCSV(const RIF::EmissionProfile_t& ep)
{
    static std::ofstream file("intercept_log.csv", std::ios::app);

    file << ep.uiEmissionID << ","
         << getStatus(ep.xEmissionStatus) << ","
         << ep.xFirstDetectionTime.toString2() << ","
         << ep.fFreqHzlast / 1e6 << ","
         << ep.fBwlast / 1e3 << ","
         << ep.fPwrlast << ","
         << ep.fSNRlast << ","
         << ep.fDOAAzlast * ROOF_RAD2DEG
         << "\n";
}

// ================= TABLE =================
void printTable()
{
    system("cls"); // Windows clear screen

    std::cout << "================ INTERCEPT LIST ================\n\n";

    std::cout << std::left
        << std::setw(8)  << "ID"
        << std::setw(10) << "Status"
        << std::setw(28) << "First Seen"
        << std::setw(12) << "Freq(MHz)"
        << std::setw(10) << "BW(kHz)"
        << std::setw(12) << "Power"
        << std::setw(10) << "SNR"
        << std::setw(10) << "DOA"
        << "\n";

    std::cout << "--------------------------------------------------------------------------\n";

    for (const auto& [id, ep] : g_emissions)
    {
        double freqMHz = ep.fFreqHzlast / 1e6;
        double bwKHz   = ep.fBwlast / 1e3;
        double doaDeg  = ep.fDOAAzlast * ROOF_RAD2DEG;

        std::cout << std::left
            << std::setw(8)  << ep.uiEmissionID
            << std::setw(10) << getStatus(ep.xEmissionStatus)
            << std::setw(28) << ep.xFirstDetectionTime.toString2()
            << std::setw(12) << std::fixed << std::setprecision(3) << freqMHz
            << std::setw(10) << std::setprecision(2) << bwKHz
            << std::setw(12) << std::setprecision(1) << ep.fPwrlast
            << std::setw(10) << std::setprecision(1) << ep.fSNRlast
            << std::setw(10) << std::setprecision(1) << doaDeg
            << "\n";
    }
}

// ================= MESSAGE HANDLER =================
static void messageReceived(const std::string& strMsgString)
{
    RI::TransportProtocolParser tp(strMsgString.c_str(), strMsgString.size());

    if (tp.domainId() != RI::Stream || tp.messageid() != RIF::ROOF_IF_MSG)
        return;

    std::string payload(tp.messageBytes(), tp.messageBytesLength());

    RIF::ROOFIFMsg_t roofMsg;
    int idx = 0;
    roofMsg.FromByteEncoding(payload, idx);

    for (size_t i = 0; i < roofMsg.size(); i++)
    {
        std::string inner = roofMsg[i].m_strValue;
        if (inner.empty()) continue;

        RI::TransportProtocolParser tp2(inner.c_str(), inner.size());

        if (tp2.messageid() == RIF::EMISSION_PROFILE_LIST_MSG)
        {
            RIF::EmissionProfileList_t epList;
            int idx2 = 0;

            std::string innerPayload(tp2.messageBytes(), tp2.messageBytesLength());
            epList.FromByteEncoding(innerPayload, idx2);

            std::lock_guard<std::mutex> lock(g_mutex);

            for (uint32_t j = 0; j < epList.length(); j++)
            {
                const auto& ep = epList.xEmissionList[j];

                // store/update emission
                g_emissions[ep.uiEmissionID] = ep;

                // export CSV
                writeCSV(ep);
            }

            printTable();
        }
    }
}

// ================= MAIN =================
int main(int argc, char** argv)
{
    std::string configPath = DEF_CONFIG_FILE_PATH;

    RCU::ProgramName::setName(argv[0], true);
    RCU::ProgramName::setPath();

    LOGGER->setupFromFile(configPath);

    RCU::Configuration config(configPath.c_str());
    config.acquire();

    std::string addr, filter;

    RCU::readConfValue(config, "SUBSCRIBER", "REMOTE_ADDRESS_LIST", addr, std::string(""));
    RCU::readConfValue(config, "SUBSCRIBER", "FILTER_LIST", filter, std::string(""));

    std::vector<std::string> addrList;
    boost::split(addrList, addr, boost::is_any_of("&"));

    std::vector<unsigned int> filterList;
    std::vector<std::string> temp;

    boost::split(temp, filter, boost::is_any_of(";"));
    for (auto& f : temp)
    {
        boost::trim(f);
        if (!f.empty())
        {
            try { filterList.push_back(std::stoi(f)); }
            catch (...) {}
        }
    }

    RI::MessageSubscriber* sub = new RI::MessageSubscriber;

    sub->setAddressList(addrList);
    sub->setFilterList(filterList);

    sub->connectToMessageReceivedSignal(messageReceived);

    if (!sub->start())
    {
        std::cout << "❌ Failed to start subscriber\n";
        return 1;
    }

    std::cout << "🚀 Live RF Monitor Running...\n";

    while (true)
        std::this_thread::sleep_for(std::chrono::seconds(1));

    sub->stop();
    delete sub;

    return 0;
}