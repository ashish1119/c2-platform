#define _CRT_SECURE_NO_WARNINGS

#include <iostream>
#include <thread>

#include <boost/algorithm/string.hpp>
#include <boost/filesystem.hpp>
#include <boost/program_options.hpp>

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

namespace BFS = boost::filesystem;
namespace BPO = boost::program_options;
namespace BS = boost::system;
namespace RCU = ROOF::core::utils;
namespace RI = ROOF::ipc;
namespace RIF = ROOF::ifmsg;


// ================= PRINT SIGNAL =================
void printEmission(const RIF::EmissionProfile_t& ep)
{
    double freqMHz = ep.fFreqHzlast / 1e6;
    double doaDeg = ep.fDOAAzlast * ROOF_RAD2DEG;

    std::cout << "\n📡 SIGNAL DATA:\n";
    std::cout << "Frequency : " << freqMHz << " MHz\n";
    std::cout << "Power     : " << ep.fPwrlast << " dBm\n";
    std::cout << "SNR       : " << ep.fSNRlast << " dB\n";
    std::cout << "DOA       : " << doaDeg << " deg\n";
}


// ================= MESSAGE HANDLER =================
static void messageReceived(const std::string& strMsgString)
{
    RI::TransportProtocolParser tp(strMsgString.c_str(), strMsgString.size());

    unsigned int msgId = tp.messageid();
    RI::DomainID domain = tp.domainId();

    std::string payload(tp.messageBytes(), tp.messageBytesLength());

    std::cout << "\n================ NEW MESSAGE ================\n";
    std::cout << "MessageId: " << msgId << std::endl;

    if (domain == RI::Stream && msgId == RIF::ROOF_IF_MSG)
    {
        RIF::ROOFIFMsg_t roofMsg;
        int idx = 0;

        roofMsg.FromByteEncoding(payload, idx);

        std::cout << "ROOFIFMsg size: " << roofMsg.size() << std::endl;

        for (size_t i = 0; i < roofMsg.size(); i++)
        {
            std::string inner = roofMsg[i].m_strValue;
            if (inner.empty()) continue;

            RI::TransportProtocolParser tp2(inner.c_str(), inner.size());

            unsigned int innerId = tp2.messageid();
            std::string innerPayload(tp2.messageBytes(), tp2.messageBytesLength());

            std::cout << "Inner Message ID: " << innerId << std::endl;

            // ================= EMISSION LIST =================
            if (innerId == RIF::EMISSION_PROFILE_LIST_MSG)
            {
                RIF::EmissionProfileList_t epList;
                int idx2 = 0;

                epList.FromByteEncoding(innerPayload, idx2);

                std::cout << "Total Emissions: " << epList.length() << std::endl;

                if (epList.length() == 0)
                {
                    std::cout << "⚠️ No emissions received\n";
                }

                for (uint32_t j = 0; j < epList.length(); j++)
                {
                    const auto& ep = epList.xEmissionList[j];
                    printEmission(ep);
                }
            }
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
            try
            {
                filterList.push_back(std::stoi(f));
            }
            catch (...)
            {
                std::cout << "Invalid filter: " << f << std::endl;
            }
            
    }

    RI::MessageSubscriber* sub = new RI::MessageSubscriber;

    sub->setAddressList(addrList);
    sub->setFilterList(filterList);

    sub->connectToMessageReceivedSignal([](const std::string& msg)
    {
        messageReceived(msg);
    });

    if (!sub->start())
    {
        std::cout << "❌ Failed to start subscriber\n";
        return 1;
    }

    std::cout << "🚀 Listening... type QUIT to exit\n";

    while (true)
    {
        std::string cmd;
        std::getline(std::cin, cmd);
        if (cmd == "QUIT") break;
    }

    sub->stop();
    delete sub;

    return 0;
}